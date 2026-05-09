"""Genera las creatividades de una propuesta usando OpenRouter (FLUX.2) o el mock.

Concurrencia: hasta 2 generaciones simultáneas (semáforo) para no inflar la
factura de OpenRouter por accidente. Cada asset se persiste cuando termina,
así la UI puede hacer polling y ver progreso parcial.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
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
    assets: list[dict[str, Any]] = []
    for i, name in enumerate(VARIANT_NAMES[: settings.CREATIVE_COUNT]):
        prompt = build_flux_prompt(product, creative_brief, i)
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


async def _persist_assets(proposal_id: UUID, assets: list[dict[str, Any]]) -> None:
    """Snapshot del array de assets sobre la proposal — usa una sesión nueva."""
    async with async_session_factory() as session:
        proposal = await session.get(Proposal, proposal_id)
        if proposal is None:
            return
        proposal.generated_assets = [dict(a) for a in assets]
        flag_modified(proposal, "generated_assets")
        await session.commit()


async def generate_creatives_for_proposal(proposal_id: UUID) -> list[dict[str, Any]]:
    """Lee la proposal, genera N creativos, los sube a Storage, persiste el array.

    Esta función abre y cierra sus propias sesiones — está diseñada para correr
    en background (asyncio.create_task) sin compartir sesión con el request HTTP.
    """
    started = time.perf_counter()

    # Bootstrap: lee proposal + product en una sesión chica.
    async with async_session_factory() as session:
        proposal = await session.get(Proposal, proposal_id)
        if proposal is None:
            logger.warning("generate_creatives | proposal %s no existe", proposal_id)
            return []
        if proposal.product_id is None:
            logger.warning("generate_creatives | proposal %s sin product_id", proposal_id)
            return []
        product = await session.get(Product, proposal.product_id)
        if product is None:
            logger.warning("generate_creatives | product %s no existe", proposal.product_id)
            return []
        merchant_id = proposal.merchant_id
        creative_brief = (proposal.payload or {}).get("creative_brief", "")
        # Inicializamos los N assets en estado generating y persistimos.
        assets = _build_initial_assets(product, creative_brief)
        proposal.generated_assets = list(assets)
        flag_modified(proposal, "generated_assets")
        await session.commit()

    logger.info(
        "generate_creatives | merchant=%s proposal=%s mock=%s count=%d",
        merchant_id,
        proposal_id,
        settings.USE_OPENROUTER_MOCK,
        len(assets),
    )

    sem = asyncio.Semaphore(_MAX_CONCURRENT)
    persist_lock = asyncio.Lock()

    async def _persist() -> None:
        async with persist_lock:
            await _persist_assets(proposal_id, assets)

    async def _one(asset: dict[str, Any], client: OpenRouterImageClient) -> None:
        idx = asset["variant_index"]
        async with sem:
            t0 = time.perf_counter()
            try:
                result = await client.generate_image(
                    asset["prompt_used"],
                    aspect_ratio=settings.CREATIVE_ASPECT_RATIO,
                )
                ext = "png"
                content_type = "image/png"
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
        "generate_creatives done | proposal=%s total=%.2fs",
        proposal_id,
        time.perf_counter() - started,
    )
    return assets


async def clear_assets(proposal_id: UUID) -> None:
    """Borra los assets actuales de la propuesta. Útil para regenerate."""
    async with async_session_factory() as session:
        proposal = await session.get(Proposal, proposal_id)
        if proposal is None:
            return
        proposal.generated_assets = []
        flag_modified(proposal, "generated_assets")
        await session.commit()
