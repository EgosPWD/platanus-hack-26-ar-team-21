import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, select

from app.agent.graph import run_vera
from app.core.deps import CurrentMerchant, DbSession
from app.db.models import AgentRun, Product, Proposal, ProposalStatus
from app.schemas.proposals import (
    AgentRunRead,
    AgentRunResult,
    ProductSnapshot,
    ProposalDecision,
    ProposalRead,
)
from app.services.image_gen import (
    clear_assets,
    init_assets_for_proposal,
    run_creative_generation,
)

logger = logging.getLogger("vera.api.proposals")
router = APIRouter(prefix="/proposals", tags=["proposals"])


def _serialize_proposal(p: Proposal, product: Product | None) -> ProposalRead:
    raw_assets = p.generated_assets
    # Defensa contra filas viejas con `{}` en vez de `[]` (pre-migración 0004).
    assets_list = raw_assets if isinstance(raw_assets, list) else []
    return ProposalRead(
        id=p.id,
        merchant_id=p.merchant_id,
        product_id=p.product_id,
        kind=p.kind.value,
        status=p.status.value,
        reasoning=p.reasoning,
        payload=p.payload or {},
        generated_assets=assets_list,
        created_at=p.created_at,
        decided_at=p.decided_at,
        product=ProductSnapshot.model_validate(product) if product else None,
    )


async def _load_proposal_with_product(
    db, merchant_id: uuid.UUID, proposal_id: uuid.UUID
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


@router.post("/run", response_model=AgentRunResult)
async def run_agent(
    merchant: CurrentMerchant,
    db: DbSession,
) -> AgentRunResult:
    """Dispara una corrida del agente Vera para el merchant logueado."""
    try:
        final_state = await run_vera(merchant.id, db, trigger="manual")
    except Exception as exc:
        logger.exception("run_vera failed for merchant %s", merchant.id)
        # Nunca devolvemos 500 sin contexto — el agente "no puede romper" desde
        # la perspectiva del usuario. Lo registramos como error técnico.
        return AgentRunResult(
            decision="skip",
            decision_reason="Tuve un problema técnico. Probá de nuevo en un rato.",
            reasoning_trace=[],
            error=str(exc),
        )

    proposal_read: ProposalRead | None = None
    proposal_id = final_state.get("proposal_id")
    if proposal_id is not None:
        proposal, product = await _load_proposal_with_product(
            db, merchant.id, proposal_id
        )
        if proposal is not None:
            proposal_read = _serialize_proposal(proposal, product)

    return AgentRunResult(
        decision=final_state.get("decision") or "skip",
        decision_reason=final_state.get("decision_reason") or "",
        proposal=proposal_read,
        reasoning_trace=final_state.get("reasoning_trace") or [],
        agent_run_id=final_state.get("agent_run_id"),
        error=final_state.get("error"),
    )


@router.get("", response_model=list[ProposalRead])
async def list_proposals(
    merchant: CurrentMerchant,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: str | None = Query(None, alias="status"),
) -> list[ProposalRead]:
    stmt = (
        select(Proposal)
        .where(Proposal.merchant_id == merchant.id)
        .order_by(desc(Proposal.created_at))
        .limit(limit)
        .offset(offset)
    )
    if status_filter:
        try:
            stmt = stmt.where(Proposal.status == ProposalStatus(status_filter))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"status inválido: {status_filter}",
            ) from exc

    proposals = (await db.execute(stmt)).scalars().all()
    if not proposals:
        return []

    product_ids = {p.product_id for p in proposals if p.product_id}
    products: dict[uuid.UUID, Product] = {}
    if product_ids:
        rows = (
            await db.execute(select(Product).where(Product.id.in_(product_ids)))
        ).scalars().all()
        products = {p.id: p for p in rows}

    return [
        _serialize_proposal(p, products.get(p.product_id) if p.product_id else None)
        for p in proposals
    ]


@router.get("/{proposal_id}", response_model=ProposalRead)
async def get_proposal(
    proposal_id: uuid.UUID,
    merchant: CurrentMerchant,
    db: DbSession,
) -> ProposalRead:
    proposal, product = await _load_proposal_with_product(db, merchant.id, proposal_id)
    if proposal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propuesta no encontrada",
        )
    return _serialize_proposal(proposal, product)


@router.post(
    "/{proposal_id}/generate",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ProposalRead,
)
async def generate_creatives(
    proposal_id: uuid.UUID,
    merchant: CurrentMerchant,
    db: DbSession,
) -> ProposalRead:
    """Dispara la generación en background. No espera a que termine.

    Si ya hay assets `ready`, devuelve 409 — el caller debería usar /regenerate
    si quiere reemplazarlos.
    """
    proposal, product = await _load_proposal_with_product(db, merchant.id, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    existing = proposal.generated_assets or []
    has_ready = any(a.get("status") == "ready" for a in existing)
    if has_ready:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya hay creatividades generadas. Usá /regenerate para reemplazarlas.",
        )

    # Sync: persiste 5 placeholders en estado generating para que el front
    # vea el grid inmediatamente y empiece a hacer polling.
    await init_assets_for_proposal(proposal_id)
    asyncio.create_task(run_creative_generation(proposal_id))
    await db.refresh(proposal)
    return _serialize_proposal(proposal, product)


@router.post(
    "/{proposal_id}/regenerate",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ProposalRead,
)
async def regenerate_creatives(
    proposal_id: uuid.UUID,
    merchant: CurrentMerchant,
    db: DbSession,
) -> ProposalRead:
    """Borra los assets viejos y dispara una corrida nueva."""
    proposal, product = await _load_proposal_with_product(db, merchant.id, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    await clear_assets(proposal_id)
    await init_assets_for_proposal(proposal_id)
    asyncio.create_task(run_creative_generation(proposal_id))
    await db.refresh(proposal)
    return _serialize_proposal(proposal, product)


@router.patch("/{proposal_id}", response_model=ProposalRead)
async def decide_proposal(
    proposal_id: uuid.UUID,
    decision: ProposalDecision,
    merchant: CurrentMerchant,
    db: DbSession,
) -> ProposalRead:
    """Aprobar / rechazar / modificar.

    Capa 3 solo cambia el status. La lógica completa (publicar, notificar)
    queda para Capas 5 y 6.
    """
    proposal, product = await _load_proposal_with_product(db, merchant.id, proposal_id)
    if proposal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propuesta no encontrada",
        )

    proposal.status = ProposalStatus(decision.status)
    proposal.decided_at = datetime.now(timezone.utc)
    if decision.notes:
        # No agregamos columna `notes` en la DB; lo metemos en el payload.
        payload = dict(proposal.payload or {})
        payload["decision_notes"] = decision.notes
        proposal.payload = payload

    await db.commit()
    await db.refresh(proposal)
    return _serialize_proposal(proposal, product)


# --- Agent runs (separado del prefijo /proposals) ---------------------------


runs_router = APIRouter(prefix="/agent-runs", tags=["agent-runs"])


@runs_router.get("", response_model=list[AgentRunRead])
async def list_agent_runs(
    merchant: CurrentMerchant,
    db: DbSession,
    limit: int = Query(10, ge=1, le=100),
) -> list[AgentRun]:
    rows = await db.execute(
        select(AgentRun)
        .where(AgentRun.merchant_id == merchant.id)
        .order_by(desc(AgentRun.created_at))
        .limit(limit)
    )
    return list(rows.scalars().all())
