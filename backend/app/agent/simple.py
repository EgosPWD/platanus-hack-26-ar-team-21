"""Fallback sin LangGraph — funciones encadenadas con la misma interfaz.

Se usa cuando LangGraph se rompe o no querés esa dependencia. Para activarlo,
en `api/proposals.py` cambiá:

    from app.agent.graph import run_vera

por:

    from app.agent.simple import run_vera

El comportamiento es idéntico salvo el motor de orquestación.
"""
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.nodes import (
    analyze_sales,
    compose_proposal,
    decide_action,
    persist_proposal,
)
from app.agent.state import Trigger, VeraState, initial_state

logger = logging.getLogger("vera.agent")


async def run_vera(
    merchant_id: UUID,
    db: AsyncSession,
    trigger: Trigger = "manual",
) -> VeraState:
    logger.info("run_vera | merchant=%s trigger=%s graph=simple", merchant_id, trigger)
    state: VeraState = initial_state(merchant_id=merchant_id, trigger=trigger)

    state = await analyze_sales(state, db)
    state = await decide_action(state, db)
    if state.get("decision") == "propose":
        state = await compose_proposal(state, db)
    state = await persist_proposal(state, db)
    return state
