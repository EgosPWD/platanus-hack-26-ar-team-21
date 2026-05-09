"""Publisher contra Meta Marketing API (Capa 6).

Toma una Proposal aprobada con N creatividades `ready` y crea:
1 Campaign (PAUSED) + 1 AdSet (PAUSED) + N AdCreatives + N Ads (PAUSED).

Persiste todo el flujo en la tabla `campaigns`. Si cualquier paso falla,
deja la Campaign con status='failed' y un error_message accionable.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Campaign, CampaignStatus, Merchant, Product, Proposal, ProposalStatus
from app.integrations.meta_ads_client import MetaAdsError
from app.publishers.base import Publisher, PublisherResult
from app.services.targeting import build_meta_targeting

# Subcode de Meta que dispara el degraded mode: app en Development.
_DEV_MODE_SUBCODE = 1885183

logger = logging.getLogger("vera.publisher.meta")


# Mínimo legal de daily_budget en la mayoría de las regiones que servimos
# (≈ USD 5/día). Si el agente sugiere algo menor, subimos al mínimo.
_MIN_DAILY_BUDGET_ARS = 500


def _build_landing_url(product: Product | None) -> str:
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    if product and product.id:
        return f"{base}/products/{product.id}"
    return base


def _ready_assets(proposal: Proposal) -> list[dict[str, Any]]:
    raw = proposal.generated_assets or []
    if not isinstance(raw, list):
        return []
    return [
        a
        for a in raw
        if isinstance(a, dict)
        and a.get("status") == "ready"
        and a.get("url")
    ]


def _budget_to_daily_cents(suggested_budget_ars: int | None) -> tuple[int, int]:
    """Devuelve (daily_budget_ars, daily_budget_cents).

    Convención: el `suggested_budget_ars` del agente es presupuesto MENSUAL.
    Lo dividimos en 30 días y respetamos un mínimo de 500 ARS/día.
    """
    monthly = max(int(suggested_budget_ars or 0), 0)
    daily_ars = max(monthly // 30, _MIN_DAILY_BUDGET_ARS) if monthly else _MIN_DAILY_BUDGET_ARS
    return daily_ars, daily_ars * 100


class MetaPublisher(Publisher):
    publisher_name = "meta"

    def __init__(self, client) -> None:  # noqa: ANN001 — duck-typed (real or mock)
        self.client = client

    # ------------------------------------------------------------- publish

    async def publish(
        self, proposal: Proposal, db: AsyncSession
    ) -> PublisherResult:
        # 1) Validaciones de pre-condición ----------------------------------
        if proposal.status != ProposalStatus.approved:
            # Esto es un bug del caller — no persistimos Campaign por
            # algo que el usuario no provocó.
            return PublisherResult(
                success=False,
                error=f"Proposal {proposal.id} no está aprobada (status={proposal.status.value}).",
            )

        merchant = await db.get(Merchant, proposal.merchant_id)
        if merchant is None:
            return PublisherResult(success=False, error="Merchant no encontrado.")

        assets = _ready_assets(proposal)
        if not assets:
            # No hay imágenes — persistimos Campaign 'failed' para que el
            # merchant lo vea en /campaigns con un mensaje accionable. El
            # botón "Reintentar publicación" después funciona si las
            # creatividades se regeneran y quedan ready.
            error_msg = (
                "No hay creatividades listas para publicar. La generación "
                "de imágenes falló (probablemente tu cuota de OpenRouter "
                "se agotó). Volvé a la propuesta y regenerá las variantes — "
                "después tocá 'Reintentar publicación' acá."
            )
            failed_campaign = Campaign(
                merchant_id=merchant.id,
                proposal_id=proposal.id,
                publisher=self.publisher_name,
                kind="meta_ads",
                status=CampaignStatus.failed,
                creative_count=0,
                error_message=error_msg,
                payload_snapshot={
                    "reason": "no_ready_assets",
                    "asset_count": 0,
                },
            )
            db.add(failed_campaign)
            await db.commit()
            return PublisherResult(success=False, error=error_msg)

        product: Product | None = None
        if proposal.product_id:
            product = await db.get(Product, proposal.product_id)

        product_name = product.name if product else "tu producto top"
        payload = proposal.payload or {}
        copy_es: str = payload.get("copy_es") or f"Conocé {product_name}"
        audience_hint: str = payload.get("audience_hint") or ""
        suggested_budget_ars = payload.get("suggested_budget_ars")
        daily_budget_ars, daily_budget_cents = _budget_to_daily_cents(suggested_budget_ars)
        landing_url = _build_landing_url(product)

        targeting = build_meta_targeting(
            audience_hint,
            merchant_currency=merchant.currency or "ARS",
            default_age_min=settings.META_DEFAULT_AGE_MIN,
            default_age_max=settings.META_DEFAULT_AGE_MAX,
        )

        # 2) Persistir Campaign en estado `creating` ANTES de llamar a Meta.
        #    Si todo se cae, queda registro de que se intentó.
        campaign = Campaign(
            merchant_id=merchant.id,
            proposal_id=proposal.id,
            publisher=self.publisher_name,
            kind="meta_ads",
            status=CampaignStatus.creating,
            creative_count=len(assets),
            budget_ars=daily_budget_ars,
            payload_snapshot={
                "copy_es": copy_es,
                "audience_hint": audience_hint,
                "targeting": targeting,
                "daily_budget_ars": daily_budget_ars,
                "monthly_budget_ars": int(suggested_budget_ars or 0),
                "landing_url": landing_url,
                "product_name": product_name,
                "product_image_url": (product.image_urls[0] if product and product.image_urls else None),
                "asset_count": len(assets),
            },
        )
        db.add(campaign)
        await db.commit()
        await db.refresh(campaign)
        campaign_pk: UUID = campaign.id

        # 3) Llamar a Meta paso por paso, capturando errores friendly.
        try:
            result_raw = await self._do_publish(
                campaign_name=f"Vera — {product_name} — {str(proposal.id)[:8]}",
                copy_es=copy_es,
                landing_url=landing_url,
                targeting=targeting,
                daily_budget_cents=daily_budget_cents,
                assets=assets,
            )
        except MetaAdsError as err:
            await self._mark_failed(db, campaign_pk, err.user_message)
            return PublisherResult(success=False, error=err.user_message)
        except Exception as exc:
            logger.exception("MetaPublisher inesperadamente falló")
            await self._mark_failed(db, campaign_pk, f"Error técnico: {exc}")
            return PublisherResult(
                success=False,
                error="Algo se rompió creando la campaña. Lo estoy mirando.",
            )

        # 4) Persistir éxito. Status='created' = existe en Meta, en pausa.
        external_id = result_raw["campaign"]["id"]
        external_url = result_raw["campaign"]["url"]

        row = await db.get(Campaign, campaign_pk)
        if row is not None:
            row.external_id = external_id
            row.external_url = external_url
            row.status = CampaignStatus.created
            row.payload_snapshot = {
                **(row.payload_snapshot or {}),
                "meta": result_raw,
            }
            await db.commit()
            await db.refresh(row)

        return PublisherResult(
            success=True,
            external_id=external_id,
            external_url=external_url,
            raw=result_raw,
        )

    async def _do_publish(
        self,
        *,
        campaign_name: str,
        copy_es: str,
        landing_url: str,
        targeting: dict[str, Any],
        daily_budget_cents: int,
        assets: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """El flujo real de creación. Cada paso logea qué se intentó para
        que cuando algo falle el log tenga el "qué" además del "por qué"."""
        # 1) Campaign
        logger.info(
            "publisher | step=create_campaign name=%r objective=OUTCOME_TRAFFIC",
            campaign_name,
        )
        campaign_resp = await self.client.create_campaign(
            name=campaign_name,
            objective="OUTCOME_TRAFFIC",
        )
        cid = campaign_resp["id"]
        logger.info("publisher | created campaign id=%s", cid)

        # 2) AdSet — una sola, con los 5 ads colgando.
        logger.info(
            "publisher | step=create_ad_set campaign_id=%s daily_budget_cents=%s targeting=%s",
            cid,
            daily_budget_cents,
            targeting,
        )
        adset_resp = await self.client.create_ad_set(
            campaign_id=cid,
            name=f"{campaign_name} · Default ad set",
            daily_budget_cents=daily_budget_cents,
            targeting=targeting,
        )
        adset_id = adset_resp["id"]
        logger.info("publisher | created ad_set id=%s", adset_id)

        # 3) Por cada creatividad ready: AdCreative + Ad
        ads: list[dict[str, Any]] = []
        ads_pending_reason: str | None = None
        for asset in assets:
            variant_name = asset.get("variant_name") or "creative"
            logger.info(
                "publisher | step=create_creative variant=%s url=%s",
                variant_name,
                asset["url"],
            )
            try:
                creative_resp = await self.client.create_creative_from_image_url(
                    name=f"{campaign_name} — {variant_name}",
                    image_url=asset["url"],
                    message=copy_es,
                    link=landing_url,
                    call_to_action="SHOP_NOW",
                    page_id=settings.META_PAGE_ID or None,
                )
            except MetaAdsError as exc:
                # Si la app está en Development y el config lo permite,
                # marcamos los ads como "pendientes Live mode" y cerramos
                # con éxito parcial — la campaña + ad_set ya existen en
                # Meta y son demoables.
                is_dev_mode = (
                    exc.code == 100
                    and (exc.raw or {}).get("subcode") == _DEV_MODE_SUBCODE
                )
                if is_dev_mode and settings.META_SKIP_AD_CREATION_IF_DEV_MODE:
                    ads_pending_reason = (
                        "Tu app de Meta está en Development. La campaña con "
                        "su targeting y presupuesto ya está creada en Ads "
                        "Manager. Los 5 ads se publican cuando tu Business "
                        "pase verificación y la app vaya a Live."
                    )
                    logger.warning(
                        "publisher | dev mode — skipping creatives/ads. "
                        "Campaign %s + ad_set %s exist in Meta.",
                        cid,
                        adset_id,
                    )
                    break
                raise

            logger.info(
                "publisher | step=create_ad creative_id=%s variant=%s",
                creative_resp["id"],
                variant_name,
            )
            ad_resp = await self.client.create_ad(
                ad_set_id=adset_id,
                creative_id=creative_resp["id"],
                name=f"{campaign_name} — {variant_name}",
            )
            ads.append(
                {
                    "asset_id": asset.get("id"),
                    "variant_name": variant_name,
                    "creative_id": creative_resp["id"],
                    "ad_id": ad_resp["id"],
                }
            )

        return {
            "campaign": campaign_resp,
            "adset": adset_resp,
            "ads": ads,
            "ads_pending_reason": ads_pending_reason,
        }

    async def _mark_failed(
        self, db: AsyncSession, campaign_pk: UUID, error_message: str
    ) -> None:
        row = await db.get(Campaign, campaign_pk)
        if row is None:
            return
        row.status = CampaignStatus.failed
        row.error_message = error_message[:1000]
        await db.commit()

    # -------------------------------------------------------- fetch_status

    async def fetch_status(self, campaign: Campaign) -> dict[str, Any]:
        if not campaign.external_id:
            return {}
        result = await self.client.fetch_campaign_status(campaign.external_id)
        return result
