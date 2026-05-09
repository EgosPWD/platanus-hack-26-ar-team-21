"""Genera las creatividades de una propuesta usando OpenRouter (FLUX.2) o el mock.

Está separado en dos pasos para que la UI pueda mostrar los placeholders en
estado `generating` apenas el endpoint responde:

- `init_assets_for_proposal` — sincrónico, persiste los N placeholders.
- `run_creative_generation` — corre las llamadas a OpenRouter, va actualizando
  cada asset a `ready`/`failed` y persiste tras cada resultado.

Concurrencia: hasta 2 llamadas simultáneas (semáforo) para no inflar la
factura de OpenRouter por accidente.

Image-to-image: si el producto tiene `image_urls`, le pasamos la primera
URL al cliente como referencia visual. Eso hace que FLUX trabaje sobre la
prenda real en vez de inventar una nueva.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import settings
from app.db.models import Product, Proposal
from app.db.session import async_session_factory
from app.integrations import OpenRouterImageClient
from app.integrations.openrouter_client import ImageGenerationError
from app.services.prompt_builder import VARIANT_NAMES, build_flux_prompt
from app.services.storage import (
    upload_image_from_bytes,
    upload_image_from_url,
)

logger = logging.getLogger("vera.image_gen")

_MAX_CONCURRENT = 2


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_client() -> OpenRouterImageClient:
    if settings.USE_OPENROUTER_MOCK:
        return OpenRouterImageClient()
    return OpenRouterImageClient(
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        model_id=settings.OPENROUTER_IMAGE_MODEL,
    )


def _build_initial_assets(product: Product, creative_brief: str) -> list[dict[str, Any]]:
    has_reference = bool(product.image_urls)
    assets: list[dict[str, Any]] = []
    for i, name in enumerate(VARIANT_NAMES[: settings.CREATIVE_COUNT]):
        prompt = build_flux_prompt(product, creative_brief, i, has_reference=has_reference)
        assets.append(
            {
                "id": str(uuid.uuid4()),
                "variant_index": i,
                "variant_name": name,
                "prompt_used": prompt,
                "status": "generating",
                "url": None,
                "content_type": None,
                "error_message": None,
                "created_at": _now_iso(),
            }
        )
    return assets


async def _persist_assets_snapshot(proposal_id: UUID, assets: list[dict[str, Any]]) -> None:
    async with async_session_factory() as session:
        proposal = await session.get(Proposal, proposal_id)
        if proposal is None:
            return
        proposal.generated_assets = [dict(a) for a in assets]
        flag_modified(proposal, "generated_assets")
        await session.commit()


async def init_assets_for_proposal(proposal_id: UUID) -> list[dict[str, Any]] | None:
    """Persiste 5 placeholders en estado `generating`. Idempotente — no rompe si
    ya hay assets, los reemplaza. Devuelve la lista o None si no hay producto.

    Es rápido (~100ms): un fetch + un commit. Diseñado para correr SYNC dentro
    del request handler así el response al frontend ya trae los placeholders.
    """
    async with async_session_factory() as session:
        proposal = await session.get(Proposal, proposal_id)
        if proposal is None or proposal.product_id is None:
            logger.warning("init_assets | proposal o product no existe (%s)", proposal_id)
            return None
        product = await session.get(Product, proposal.product_id)
        if product is None:
            logger.warning("init_assets | product %s no existe", proposal.product_id)
            return None
        creative_brief = (proposal.payload or {}).get("creative_brief", "")
        assets = _build_initial_assets(product, creative_brief)
        proposal.generated_assets = list(assets)
        flag_modified(proposal, "generated_assets")
        await session.commit()
    logger.info(
        "init_assets | proposal=%s count=%d has_reference=%s",
        proposal_id,
        len(assets),
        bool(product.image_urls),
    )
    return assets


async def run_creative_generation(proposal_id: UUID) -> list[dict[str, Any]]:
    """Corre las llamadas a OpenRouter para una proposal que YA tiene assets
    en `generating`. Va actualizando cada uno y persistiendo después de cada
    resultado (con lock). Pensado para `asyncio.create_task` en background.
    """
    started = time.perf_counter()

    async with async_session_factory() as session:
        proposal = await session.get(Proposal, proposal_id)
        if proposal is None or proposal.product_id is None:
            return []
        product = await session.get(Product, proposal.product_id)
        if product is None:
            return []
        merchant_id = proposal.merchant_id
        # Trabajamos sobre una copia local; los placeholders ya fueron persistidos
        # por `init_assets_for_proposal`.
        assets = [dict(a) for a in (proposal.generated_assets or [])]
        reference_image_url: str | None = (
            product.image_urls[0] if product.image_urls else None
        )

    if not assets:
        logger.warning("run_creative_generation | no hay assets para %s", proposal_id)
        return []

    logger.info(
        "run_creative_generation | merchant=%s proposal=%s mock=%s count=%d ref=%s",
        merchant_id,
        proposal_id,
        settings.USE_OPENROUTER_MOCK,
        len(assets),
        "yes" if reference_image_url else "no",
    )

    sem = asyncio.Semaphore(_MAX_CONCURRENT)
    persist_lock = asyncio.Lock()

    async def _persist() -> None:
        async with persist_lock:
            await _persist_assets_snapshot(proposal_id, assets)

    async def _one(asset: dict[str, Any], client: OpenRouterImageClient) -> None:
        idx = asset["variant_index"]
        async with sem:
            t0 = time.perf_counter()
            try:
                result = await client.generate_image(
                    asset["prompt_used"],
                    reference_image_url=reference_image_url,
                    aspect_ratio=settings.CREATIVE_ASPECT_RATIO,
                )
                content_type = "image/png"
                ext = "png"
                dest_path = (
                    f"{merchant_id}/{proposal_id}/variant_{idx}_{asset['id'][:8]}.{ext}"
                )
                if isinstance(result, bytes):
                    public_url = await upload_image_from_bytes(
                        result, dest_path, content_type
                    )
                else:
                    public_url = await upload_image_from_url(result, dest_path)
                asset["url"] = public_url
                asset["status"] = "ready"
                asset["content_type"] = content_type
                asset["error_message"] = None
                logger.info(
                    "creative ready | proposal=%s variant=%d (%s) took=%.2fs",
                    proposal_id,
                    idx,
                    asset["variant_name"],
                    time.perf_counter() - t0,
                )
            except ImageGenerationError as exc:
                asset["status"] = "failed"
                asset["error_message"] = str(exc)[:300]
                logger.warning(
                    "creative failed (gen) | proposal=%s variant=%d err=%s",
                    proposal_id,
                    idx,
                    exc,
                )
            except Exception as exc:
                asset["status"] = "failed"
                asset["error_message"] = f"unexpected: {exc}"[:300]
                logger.exception(
                    "creative failed (unexpected) | proposal=%s variant=%d",
                    proposal_id,
                    idx,
                )
            await _persist()

    async with _make_client() as client:
        await asyncio.gather(*[_one(a, client) for a in assets])

    logger.info(
        "run_creative_generation done | proposal=%s total=%.2fs",
        proposal_id,
        time.perf_counter() - started,
    )
    return assets


async def generate_creatives_for_proposal(proposal_id: UUID) -> list[dict[str, Any]]:
    """Conveniencia: init + run en una sola corrida. Útil para casos donde
    no necesitás separar el init del run (ej: scripts manuales).

    El flujo HTTP debería usar `init_assets_for_proposal` (sync) +
    `run_creative_generation` (background) por separado.
    """
    initialized = await init_assets_for_proposal(proposal_id)
    if initialized is None:
        return []
    return await run_creative_generation(proposal_id)


async def clear_assets(proposal_id: UUID) -> None:
    """Borra los assets actuales de la propuesta. Útil para regenerate."""
    async with async_session_factory() as session:
        proposal = await session.get(Proposal, proposal_id)
        if proposal is None:
            return
        proposal.generated_assets = []
        flag_modified(proposal, "generated_assets")
        await session.commit()
