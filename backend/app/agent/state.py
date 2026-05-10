"""Estado compartido del grafo de Vera.

Es un TypedDict porque LangGraph requiere que el state sea serializable y
direccionable por nombre. Todos los campos son opcionales (`total=False`)
porque cada nodo va llenando los suyos.
"""
from typing import Any, Literal, TypedDict
from uuid import UUID

Trigger = Literal["manual", "scheduled", "shopify_order"]
Decision = Literal["propose", "skip"]


class VeraState(TypedDict, total=False):
    # Input
    merchant_id: UUID
    trigger: Trigger
    sales_window_days: int

    # Llenado por analyze_sales
    sales_summary: dict[str, Any] | None
    top_product: dict[str, Any] | None

    # Llenado por decide_action
    decision: Decision | None
    decision_reason: str | None

    # Llenado por compose_proposal
    proposal_payload: dict[str, Any] | None

    # Output (llenado por persist_proposal)
    proposal_id: UUID | None
    agent_run_id: UUID | None

    # Bitácora visible para humanos. Cada nodo appendea una línea.
    reasoning_trace: list[str]

    # Si algún nodo falló de forma controlada, se guarda el motivo acá.
    error: str | None


def initial_state(
    merchant_id: UUID,
    trigger: Trigger = "manual",
    sales_window_days: int = 7,
) -> VeraState:
    return VeraState(
        merchant_id=merchant_id,
        trigger=trigger,
        sales_window_days=sales_window_days,
        reasoning_trace=[],
    )
