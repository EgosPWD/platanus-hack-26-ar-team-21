"""Acciones humanas sobre propuestas, reutilizadas por HTTP y WhatsApp."""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Campaign, Product, Proposal, ProposalStatus
from app.services.notifier import (
    is_user_actionable_error,
    notify_campaign_created,
    notify_proposal_approved,
    notify_proposal_rejected,
    notify_publication_failed,
)

logger = logging.getLogger("vera.services.proposal_actions")


async def load_proposal_with_product(
    db: AsyncSession, merchant_id: uuid.UUID, proposal_id: uuid.UUID
) -> tuple[Proposal | None, Product | None]:
    proposal = (
        await db.execute(
            select(Proposal).where(
                Proposal.id == proposal_id,
                Proposal.merchant_id == merchant_id,
            )
        )
    ).scalar_one_or_none()
    if proposal is None:
        return None, None
    product = None
    if proposal.product_id:
        product = (
            await db.execute(select(Product).where(Product.id == proposal.product_id))
        ).scalar_one_or_none()
    return proposal, product


def ensure_decidable(proposal: Proposal) -> None:
    if proposal.status not in (ProposalStatus.pending, ProposalStatus.modified):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La propuesta ya está {proposal.status.value}",
        )


def attach_decision_notes(proposal: Proposal, notes: str | None) -> None:
    if not notes:
        return
    payload = dict(proposal.payload or {})
    payload["decision_notes"] = notes
    proposal.payload = payload


async def approve_proposal_for_merchant(
    db: AsyncSession,
    *,
    merchant_id: uuid.UUID,
    proposal_id: uuid.UUID,
    notes: str | None = None,
    send_decision_notification: bool = True,
) -> tuple[Proposal, Product | None]:
    proposal, product = await load_proposal_with_product(db, merchant_id, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")
    ensure_decidable(proposal)

    proposal.status = ProposalStatus.approved
    proposal.decided_at = datetime.now(timezone.utc)
    attach_decision_notes(proposal, notes)
    await db.commit()
    await db.refresh(proposal)

    if send_decision_notification:
        asyncio.create_task(_safe_notify(notify_proposal_approved, proposal_id))
    asyncio.create_task(_safe_publish_to_meta(proposal_id))
    return proposal, product


async def reject_proposal_for_merchant(
    db: AsyncSession,
    *,
    merchant_id: uuid.UUID,
    proposal_id: uuid.UUID,
    notes: str | None = None,
    send_decision_notification: bool = True,
) -> tuple[Proposal, Product | None]:
    proposal, product = await load_proposal_with_product(db, merchant_id, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")
    ensure_decidable(proposal)

    proposal.status = ProposalStatus.rejected
    proposal.decided_at = datetime.now(timezone.utc)
    attach_decision_notes(proposal, notes)
    await db.commit()
    await db.refresh(proposal)

    if send_decision_notification:
        asyncio.create_task(_safe_notify(notify_proposal_rejected, proposal_id))
    return proposal, product


async def modify_proposal_for_merchant(
    db: AsyncSession,
    *,
    merchant_id: uuid.UUID,
    proposal_id: uuid.UUID,
    changes: dict[str, Any],
) -> tuple[Proposal, Product | None]:
    proposal, product = await load_proposal_with_product(db, merchant_id, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")
    if proposal.status not in (ProposalStatus.pending, ProposalStatus.modified):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No puedo modificar una propuesta {proposal.status.value}",
        )

    allowed = {"copy_es", "audience_hint", "suggested_budget_ars", "creative_brief"}
    whitelisted = {k: v for k, v in changes.items() if k in allowed}
    if not whitelisted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay campos válidos para modificar",
        )

    payload = dict(proposal.payload or {})
    payload.update(whitelisted)
    proposal.payload = payload
    proposal.status = ProposalStatus.modified
    proposal.decided_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(proposal)
    return proposal, product


async def _safe_notify(fn, proposal_id: uuid.UUID) -> None:
    try:
        await fn(proposal_id)
    except Exception:
        logger.exception("notification %s failed for proposal=%s", fn.__name__, proposal_id)


async def _safe_publish_to_meta(proposal_id: uuid.UUID) -> None:
    """Crea la campaña en Meta Ads tras la aprobación, siempre en background."""
    from app.core.config import settings as _settings
    from app.db.session import async_session_factory
    from app.integrations import MetaAdsClient
    from app.publishers.meta import MetaPublisher
    from app.publishers.meta_mock import MetaMockPublisher

    try:
        async with async_session_factory() as db:
            proposal = await db.get(Proposal, proposal_id)
            if proposal is None:
                logger.warning("publish_to_meta | proposal %s no existe", proposal_id)
                return

            if _settings.USE_META_MOCK:
                client = MetaAdsClient()
                publisher: MetaPublisher = MetaMockPublisher(client)
            else:
                client = MetaAdsClient(
                    access_token=_settings.META_ACCESS_TOKEN,
                    ad_account_id=_settings.META_AD_ACCOUNT_ID,
                    api_version=_settings.META_API_VERSION,
                )
                publisher = MetaPublisher(client)

            result = await publisher.publish(proposal, db)

        if result.success:
            async with async_session_factory() as db:
                row = (
                    await db.execute(
                        select(Campaign)
                        .where(Campaign.proposal_id == proposal_id)
                        .order_by(desc(Campaign.created_at))
                        .limit(1)
                    )
                ).scalar_one_or_none()
            if row is not None:
                try:
                    await notify_campaign_created(row.id)
                except Exception:
                    logger.exception("notify_campaign_created crashed campaign=%s", row.id)
        else:
            logger.warning("publish_to_meta | proposal=%s failed: %s", proposal_id, result.error)
            if is_user_actionable_error(result.error):
                try:
                    await notify_publication_failed(proposal_id, result.error or "")
                except Exception:
                    logger.exception("notify_publication_failed crashed for proposal=%s", proposal_id)
    except Exception:
        logger.exception("publish_to_meta crashed for proposal=%s", proposal_id)
