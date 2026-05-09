"""Grafo de LangGraph del agente Vera.

Flujo:

  analyze_sales → decide_action ──[propose]──▶ compose_proposal ─┐
                              └──[skip]───────────────────────────┤
                                                                  ▼
                                                          persist_proposal → END

Se compila por-request con la AsyncSession adentro del closure así los nodos
módulo-level (ver `nodes.py`) pueden recibir el `db` sin pasarlo por state.
"""
import logging
from uuid import UUID

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.nodes import (
    analyze_sales,
    compose_proposal,
    decide_action,
    persist_proposal,
)
from app.agent.state import Trigger, VeraState, initial_state

logger = logging.getLogger("vera.agent")


def _build_graph(db: AsyncSession):
    async def _analyze(state: VeraState) -> VeraState:
        return await analyze_sales(state, db)

    async def _decide(state: VeraState) -> VeraState:
        return await decide_action(state, db)

    async def _compose(state: VeraState) -> VeraState:
        return await compose_proposal(state, db)

    async def _persist(state: VeraState) -> VeraState:
        return await persist_proposal(state, db)

    builder: StateGraph = StateGraph(VeraState)
    builder.add_node("analyze_sales", _analyze)
    builder.add_node("decide_action", _decide)
    builder.add_node("compose_proposal", _compose)
    builder.add_node("persist_proposal", _persist)

    builder.set_entry_point("analyze_sales")
    builder.add_edge("analyze_sales", "decide_action")
    builder.add_conditional_edges(
        "decide_action",
        lambda s: s.get("decision") or "skip",
        {
            "propose": "compose_proposal",
            "skip": "persist_proposal",
        },
    )
    builder.add_edge("compose_proposal", "persist_proposal")
    builder.add_edge("persist_proposal", END)

    return builder.compile()


async def run_vera(
    merchant_id: UUID,
    db: AsyncSession,
    trigger: Trigger = "manual",
) -> VeraState:
    """Punto de entrada público del agente con LangGraph."""
    logger.info("run_vera | merchant=%s trigger=%s graph=langgraph", merchant_id, trigger)
    graph = _build_graph(db)
    state = initial_state(merchant_id=merchant_id, trigger=trigger)
    final: VeraState = await graph.ainvoke(state)
    return final
