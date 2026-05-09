"""Endpoints de campañas (Capa 6)."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, select

from app.core.config import settings
from app.core.deps import CurrentMerchant, DbSession
from app.db.models import Campaign, CampaignStatus, Product, Proposal
from app.integrations import MetaAdsClient
from app.publishers.meta import MetaPublisher
from app.publishers.meta_mock import MetaMockPublisher
from app.schemas.campaigns import (
    CampaignKind,
    CampaignMetrics,
    CampaignRead,
    CampaignStatusEnum,
)

logger = logging.getLogger("vera.api.campaigns")
router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _serialize(campaign: Campaign, product: Product | None) -> CampaignRead:
    metrics_raw = campaign.metrics or {}
    metrics = CampaignMetrics(
        impressions=metrics_raw.get("impressions"),
        clicks=metrics_raw.get("clicks"),
        reach=metrics_raw.get("reach"),
        ctr=metrics_raw.get("ctr"),
    )
    kind_value = campaign.kind or "meta_ads"
    try:
        kind = CampaignKind(kind_value)
    except ValueError:
        kind = CampaignKind.meta_ads
    return CampaignRead(
        id=campaign.id,
        merchant_id=campaign.merchant_id,
        proposal_id=campaign.proposal_id,
        kind=kind,
        status=CampaignStatusEnum(campaign.status.value),
        publisher=campaign.publisher,
        external_id=campaign.external_id,
        external_url=campaign.external_url,
        creative_count=campaign.creative_count or 0,
        budget_ars=campaign.budget_ars,
        error_message=campaign.error_message,
        payload_snapshot=campaign.payload_snapshot or {},
        metrics=metrics,
        created_at=campaign.created_at,
        started_at=campaign.started_at,
        ended_at=campaign.ended_at,
        last_synced_at=campaign.last_synced_at,
        product_name=(product.name if product else None),
        product_image_url=(
            product.image_urls[0]
            if product and product.image_urls
            else None
        ),
    )


async def _product_for_campaign(db, campaign: Campaign) -> Product | None:
    proposal = await db.get(Proposal, campaign.proposal_id)
    if proposal is None or proposal.product_id is None:
        return None
    return await db.get(Product, proposal.product_id)


async def _load_campaign_for_merchant(
    db, merchant_id: uuid.UUID, campaign_id: uuid.UUID
) -> tuple[Campaign | None, Product | None]:
    campaign = (
        await db.execute(
            select(Campaign).where(
                Campaign.id == campaign_id,
                Campaign.merchant_id == merchant_id,
            )
        )
    ).scalar_one_or_none()
    if campaign is None:
        return None, None
    product = await _product_for_campaign(db, campaign)
    return campaign, product


def _make_publisher() -> MetaPublisher:
    if settings.USE_META_MOCK:
        return MetaMockPublisher(MetaAdsClient())
    return MetaPublisher(
        MetaAdsClient(
            access_token=settings.META_ACCESS_TOKEN,
            ad_account_id=settings.META_AD_ACCOUNT_ID,
            api_version=settings.META_API_VERSION,
        )
    )


# --- Listado ----------------------------------------------------------------


@router.get("", response_model=list[CampaignRead])
async def list_campaigns(
    merchant: CurrentMerchant,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: str | None = Query(None, alias="status"),
) -> list[CampaignRead]:
    stmt = (
        select(Campaign)
        .where(Campaign.merchant_id == merchant.id)
        .order_by(desc(Campaign.created_at))
        .limit(limit)
        .offset(offset)
    )
    if status_filter:
        try:
            stmt = stmt.where(Campaign.status == CampaignStatus(status_filter))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"status inválido: {status_filter}",
            ) from exc

    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        return []

    proposal_ids = {c.proposal_id for c in rows}
    proposals: dict[uuid.UUID, Proposal] = {}
    if proposal_ids:
        proposal_rows = (
            await db.execute(select(Proposal).where(Proposal.id.in_(proposal_ids)))
        ).scalars().all()
        proposals = {p.id: p for p in proposal_rows}

    product_ids = {
        p.product_id for p in proposals.values() if p.product_id is not None
    }
    products: dict[uuid.UUID, Product] = {}
    if product_ids:
        product_rows = (
            await db.execute(select(Product).where(Product.id.in_(product_ids)))
        ).scalars().all()
        products = {pr.id: pr for pr in product_rows}

    serialized: list[CampaignRead] = []
    for c in rows:
        proposal = proposals.get(c.proposal_id)
        product = (
            products.get(proposal.product_id)
            if proposal and proposal.product_id
            else None
        )
        serialized.append(_serialize(c, product))
    return serialized


# --- Detalle ----------------------------------------------------------------


@router.get("/{campaign_id}", response_model=CampaignRead)
async def get_campaign(
    campaign_id: uuid.UUID,
    merchant: CurrentMerchant,
    db: DbSession,
) -> CampaignRead:
    campaign, product = await _load_campaign_for_merchant(db, merchant.id, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return _serialize(campaign, product)


# --- Refresh desde Meta -----------------------------------------------------


@router.post("/{campaign_id}/refresh", response_model=CampaignRead)
async def refresh_campaign(
    campaign_id: uuid.UUID,
    merchant: CurrentMerchant,
    db: DbSession,
) -> CampaignRead:
    campaign, product = await _load_campaign_for_merchant(db, merchant.id, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not campaign.external_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La campaña no tiene id externo todavía (¿está creando?)",
        )

    publisher = _make_publisher()
    try:
        meta_status = await publisher.fetch_status(campaign)
    except Exception as exc:
        logger.warning("refresh_campaign | %s falló: %s", campaign_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No pude leer el estado en Meta: {exc}",
        ) from exc

    # Mapeamos el effective_status de Meta a nuestro enum local. Si no
    # entendemos el valor, dejamos el status como estaba.
    effective = (meta_status.get("effective_status") or "").upper()
    new_status: CampaignStatus | None = None
    if effective == "ACTIVE":
        new_status = CampaignStatus.active
    elif effective in {"PAUSED", "CAMPAIGN_PAUSED"}:
        new_status = CampaignStatus.paused
    elif effective in {"ARCHIVED", "DELETED"}:
        new_status = CampaignStatus.finished

    if new_status:
        campaign.status = new_status
    campaign.last_synced_at = datetime.now(timezone.utc)
    snapshot = dict(campaign.payload_snapshot or {})
    snapshot["last_meta_sync"] = meta_status
    campaign.payload_snapshot = snapshot
    await db.commit()
    await db.refresh(campaign)

    return _serialize(campaign, product)


# --- Campaign by proposal ---------------------------------------------------

# Router separado, mismo módulo, montado en /proposals/{id}/campaign para que
# el frontend pueda consultar la campaña asociada a una propuesta sin saber
# el campaign_id por adelantado.
proposals_campaign_router = APIRouter(
    prefix="/proposals", tags=["campaigns"]
)


@proposals_campaign_router.get(
    "/{proposal_id}/campaign", response_model=CampaignRead
)
async def get_campaign_for_proposal(
    proposal_id: uuid.UUID,
    merchant: CurrentMerchant,
    db: DbSession,
) -> CampaignRead:
    # Verificar que la propuesta pertenece al merchant.
    proposal = (
        await db.execute(
            select(Proposal).where(
                Proposal.id == proposal_id,
                Proposal.merchant_id == merchant.id,
            )
        )
    ).scalar_one_or_none()
    if proposal is None:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    campaign = (
        await db.execute(
            select(Campaign)
            .where(Campaign.proposal_id == proposal_id)
            .order_by(desc(Campaign.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if campaign is None:
        raise HTTPException(
            status_code=404, detail="Esa propuesta todavía no tiene campaña"
        )

    product = await _product_for_campaign(db, campaign)
    return _serialize(campaign, product)
