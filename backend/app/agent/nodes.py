"""Nodos del grafo de Vera.

Cada nodo es una función async que recibe (state, db) y devuelve el state
actualizado. Las funciones son módulo-level a propósito para que `graph.py`
las pueda envolver con la sesión de DB y `simple.py` las pueda encadenar.
"""
import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.prompts import (
    ANALYZE_SYSTEM_PROMPT,
    COMPOSE_SYSTEM_PROMPT,
    DECISION_SYSTEM_PROMPT,
)
from app.agent.state import VeraState
from app.core.config import settings
from app.db.models import AgentRun, Merchant, Product, Proposal, ProposalKind, ProposalStatus, Sale
from app.services.analytics import get_sales_summary

logger = logging.getLogger("vera.agent")


# --- LLM helper -------------------------------------------------------------


def _make_llm(temperature: float = 0.7) -> ChatAnthropic:
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY no está configurado en .env"
        )
    return ChatAnthropic(
        model=settings.AGENT_MODEL,
        api_key=settings.ANTHROPIC_API_KEY,
        temperature=temperature,
        max_tokens=600,
    )


def _trace(state: VeraState, line: str) -> None:
    """Append idempotente a reasoning_trace, asegura que la lista existe."""
    trace = state.setdefault("reasoning_trace", [])
    trace.append(line)


# --- Nodo 1: analyze_sales --------------------------------------------------


async def _fetch_merchant(db: AsyncSession, merchant_id: UUID) -> Merchant | None:
    return (
        await db.execute(select(Merchant).where(Merchant.id == merchant_id))
    ).scalar_one_or_none()


async def _compute_top_product(
    db: AsyncSession, merchant_id: UUID, days: int
) -> dict[str, Any] | None:
    """Trae el producto top y el promedio de unidades del catálogo en la ventana."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        await db.execute(
            select(
                Product.id,
                Product.name,
                Product.image_urls,
                Product.price,
                func.coalesce(func.sum(Sale.quantity), 0).label("units"),
                func.coalesce(func.sum(Sale.revenue), 0).label("revenue"),
            )
            .outerjoin(
                Sale,
                (Sale.product_id == Product.id) & (Sale.sold_at >= cutoff),
            )
            .where(Product.merchant_id == merchant_id, Product.is_active.is_(True))
            .group_by(Product.id, Product.name, Product.image_urls, Product.price)
        )
    ).all()

    if not rows:
        return None

    units_per_product = [int(r.units) for r in rows]
    total_units = sum(units_per_product)
    if total_units == 0:
        return None

    avg_units = total_units / max(len(units_per_product), 1)

    top = max(rows, key=lambda r: int(r.units))
    if int(top.units) == 0:
        return None

    return {
        "product_id": str(top.id),
        "name": top.name,
        "units": int(top.units),
        "revenue": float(Decimal(str(top.revenue))),
        "image_urls": top.image_urls or [],
        "price": float(Decimal(str(top.price))),
        "avg_units_in_catalog": round(avg_units, 2),
        "ratio_vs_average": round(int(top.units) / avg_units, 2) if avg_units else 0.0,
        "catalog_size": len(rows),
    }


async def analyze_sales(state: VeraState, db: AsyncSession) -> VeraState:
    """Lee ventas, identifica top seller, narra el análisis con la voz de Vera."""
    started = time.perf_counter()
    merchant_id = state["merchant_id"]
    days = state.get("sales_window_days", 7)

    merchant = await _fetch_merchant(db, merchant_id)
    if merchant is None:
        state["error"] = f"merchant {merchant_id} no existe"
        _trace(state, f"No encontré el merchant {merchant_id}.")
        logger.warning("analyze_sales: merchant %s not found", merchant_id)
        return state

    summary = await get_sales_summary(merchant_id, days, db)
    state["sales_summary"] = summary.model_dump(mode="json")

    top = await _compute_top_product(db, merchant_id, days)
    state["top_product"] = top

    if top is None:
        msg = (
            f"Esta semana no veo ventas todavía en \"{merchant.business_name}\". "
            "Cuando empiecen a entrar órdenes te aviso."
        )
        _trace(state, msg)
        logger.info(
            "analyze_sales | merchant=%s no sales (took %.2fs)",
            merchant_id,
            time.perf_counter() - started,
        )
        return state

    user_msg = (
        f"Datos de la última ventana de {days} días:\n"
        f"- catálogo activo: {top['catalog_size']} productos\n"
        f"- top seller: {top['name']} con {top['units']} unidades\n"
        f"- promedio del catálogo: {top['avg_units_in_catalog']} unidades por producto\n"
        f"- el top vendió {top['ratio_vs_average']}x el promedio\n"
        f"- facturado total semana: {summary.total_revenue} {merchant.currency}\n"
        f"\nEscribime tu lectura del patrón en 2-3 oraciones."
    )

    try:
        llm = _make_llm(temperature=0.7)
        response = await llm.ainvoke(
            [
                SystemMessage(
                    content=ANALYZE_SYSTEM_PROMPT.format(
                        merchant_name=merchant.business_name
                    )
                ),
                HumanMessage(content=user_msg),
            ]
        )
        analysis_text = (response.content or "").strip()
    except Exception as exc:
        logger.exception("analyze_sales: Claude call failed")
        state["error"] = f"llm_error: {exc}"
        _trace(
            state,
            f"Detecté que \"{top['name']}\" lidera con {top['units']} unidades, "
            f"{top['ratio_vs_average']}x el promedio del catálogo.",
        )
        return state

    _trace(state, analysis_text)
    logger.info(
        "analyze_sales | merchant=%s top=%s units=%d ratio=%.2f (took %.2fs)",
        merchant_id,
        top["name"],
        top["units"],
        top["ratio_vs_average"],
        time.perf_counter() - started,
    )
    return state


# --- Nodo 2: decide_action --------------------------------------------------


async def _has_recent_proposal(
    db: AsyncSession, merchant_id: UUID, product_id: UUID, cooldown_days: int
) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(days=cooldown_days)
    row = (
        await db.execute(
            select(Proposal.id)
            .where(
                Proposal.merchant_id == merchant_id,
                Proposal.product_id == product_id,
                Proposal.created_at >= cutoff,
            )
            .limit(1)
        )
    ).first()
    return row is not None


async def decide_action(state: VeraState, db: AsyncSession) -> VeraState:
    """Aplica las 3 reglas duras y deja que Claude verbalice el por qué."""
    started = time.perf_counter()
    top = state.get("top_product")
    merchant_id = state["merchant_id"]

    # Regla rápida sin LLM: si no hay top, skip.
    if top is None:
        state["decision"] = "skip"
        state["decision_reason"] = (
            "Esta semana las ventas están parejas, no veo un ganador claro todavía."
        )
        _trace(state, state["decision_reason"])
        logger.info("decide_action | skip (no top product)")
        return state

    units = int(top["units"])
    ratio = float(top["ratio_vs_average"])
    product_id = UUID(top["product_id"])

    enough_sales = units >= settings.AGENT_MIN_SALES_FOR_PROPOSAL
    enough_ratio = ratio >= settings.AGENT_MIN_RATIO_VS_AVERAGE
    no_cooldown = not await _has_recent_proposal(
        db, merchant_id, product_id, settings.AGENT_COOLDOWN_DAYS
    )

    will_propose = enough_sales and enough_ratio and no_cooldown

    rule_summary = (
        f"Ventas top: {units} (mínimo {settings.AGENT_MIN_SALES_FOR_PROPOSAL}). "
        f"Ratio: {ratio}x (mínimo {settings.AGENT_MIN_RATIO_VS_AVERAGE}x). "
        f"Cooldown {settings.AGENT_COOLDOWN_DAYS}d: "
        f"{'libre' if no_cooldown else 'activo (ya hay propuesta reciente)'}."
    )
    user_msg = (
        f"Producto top: {top['name']}\n"
        f"{rule_summary}\n"
        f"Resultado: {'PROPONER' if will_propose else 'NO PROPONER'}\n\n"
        "Escribime el reason en una sola frase humana, voseo, sin mencionar 'reglas' "
        "ni 'criterios'. Solo el reason, sin preámbulo."
    )

    try:
        llm = _make_llm(temperature=0.5)
        response = await llm.ainvoke(
            [
                SystemMessage(
                    content=DECISION_SYSTEM_PROMPT.format(
                        min_sales=settings.AGENT_MIN_SALES_FOR_PROPOSAL,
                        min_ratio=settings.AGENT_MIN_RATIO_VS_AVERAGE,
                        cooldown_days=settings.AGENT_COOLDOWN_DAYS,
                    )
                ),
                HumanMessage(content=user_msg),
            ]
        )
        reason_text = (response.content or "").strip().strip('"').strip()
    except Exception as exc:
        logger.exception("decide_action: Claude call failed")
        # Fallback: mensaje seco pero correcto.
        if will_propose:
            reason_text = (
                f'"{top["name"]}" se vendió {ratio}x el promedio esta semana, '
                "vamos con campaña."
            )
        elif not enough_sales:
            reason_text = "Todavía no hay suficientes ventas para sacar conclusiones."
        elif not enough_ratio:
            reason_text = "Las ventas están repartidas, no hay un ganador claro."
        else:
            reason_text = "Ya te propuse algo similar hace poco, esperemos a ver cómo va."

    state["decision"] = "propose" if will_propose else "skip"
    state["decision_reason"] = reason_text
    _trace(state, reason_text)
    logger.info(
        "decide_action | decision=%s reason=%r (took %.2fs)",
        state["decision"],
        reason_text,
        time.perf_counter() - started,
    )
    return state


# --- Nodo 3: compose_proposal -----------------------------------------------


class _ComposedProposal(BaseModel):
    """Output estructurado que le pedimos a Claude en compose_proposal."""

    copy_es: str = Field(max_length=140)
    audience_hint: str
    suggested_budget_ars: int = Field(ge=5000, le=30000)
    creative_brief: str
    reasoning_for_human: str


async def compose_proposal(state: VeraState, db: AsyncSession) -> VeraState:
    """Genera copy + audiencia + presupuesto + brief + reasoning humano."""
    started = time.perf_counter()
    top = state.get("top_product")
    merchant_id = state["merchant_id"]
    if top is None or state.get("decision") != "propose":
        return state

    merchant = await _fetch_merchant(db, merchant_id)
    merchant_name = merchant.business_name if merchant else "tu tienda"

    user_msg = (
        f"Producto a amplificar: {top['name']}\n"
        f"Precio: ${top['price']} {merchant.currency if merchant else 'ARS'}\n"
        f"Vendió {top['units']} unidades en los últimos {state['sales_window_days']} días "
        f"({top['ratio_vs_average']}x el promedio del catálogo).\n"
        f"Facturado por este producto: ${top['revenue']}\n"
        "Armá la propuesta como te indiqué."
    )

    # Fecha en español argentino — Windows no soporta %-d, así que la armamos a mano.
    now = datetime.now(timezone.utc)
    months_es = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]
    today_es = f"{now.day} de {months_es[now.month - 1]} de {now.year}"

    try:
        llm = _make_llm(temperature=0.6)
        structured = llm.with_structured_output(_ComposedProposal)
        composed: _ComposedProposal = await structured.ainvoke(
            [
                SystemMessage(
                    content=COMPOSE_SYSTEM_PROMPT.format(
                        product_name=top["name"],
                        merchant_name=merchant_name,
                        today_es=today_es,
                    )
                ),
                HumanMessage(content=user_msg),
            ]
        )
    except (ValidationError, Exception) as exc:
        logger.exception("compose_proposal: Claude call failed")
        # Fallback mínimo: si falla el LLM, seguimos pero con un payload simple.
        # Igualmente esto rompería el "reasoning humano específico", así que es
        # un mal-menor — preferimos guardar algo a perder la propuesta entera.
        state["error"] = f"compose_error: {exc}"
        composed = _ComposedProposal(
            copy_es=f"Conocé {top['name']}. Envíos a todo el país.",
            audience_hint="público general interesado en moda",
            suggested_budget_ars=settings.AGENT_DEFAULT_BUDGET_ARS,
            creative_brief=(
                f"Fotos lifestyle del producto, mood cálido, fondo limpio, luz natural."
            ),
            reasoning_for_human=(
                f'Detecté que "{top["name"]}" vendió {top["units"]} unidades esta '
                f"semana, {top['ratio_vs_average']}x el promedio. Te propongo "
                "amplificarlo. ¿Lo vemos?"
            ),
        )

    state["proposal_payload"] = {
        "copy_es": composed.copy_es,
        "audience_hint": composed.audience_hint,
        "suggested_budget_ars": composed.suggested_budget_ars,
        "creative_brief": composed.creative_brief,
    }
    # Reemplazamos el reason de decide_action por el reasoning humano más rico
    # del compose; el de decide queda en el trace para debug.
    _trace(state, composed.reasoning_for_human)
    logger.info(
        "compose_proposal | budget=%d copy=%r (took %.2fs)",
        composed.suggested_budget_ars,
        composed.copy_es,
        time.perf_counter() - started,
    )
    return state


# --- Nodo 4: persist_proposal -----------------------------------------------


def _state_to_jsonable(state: VeraState) -> dict[str, Any]:
    """Serializa el state para guardarlo en agent_runs.state (JSONB)."""
    serializable: dict[str, Any] = {}
    for k, v in state.items():
        if isinstance(v, UUID):
            serializable[k] = str(v)
        else:
            serializable[k] = v
    return serializable


async def persist_proposal(state: VeraState, db: AsyncSession) -> VeraState:
    """Persiste la propuesta (si hay) y siempre persiste el agent_run."""
    started = time.perf_counter()
    merchant_id = state["merchant_id"]
    decision = state.get("decision", "skip")

    if decision == "propose" and state.get("top_product") and state.get("proposal_payload"):
        top = state["top_product"]
        product_id = UUID(top["product_id"])
        # El último item del trace es el reasoning humano; si no hay, usamos el reason.
        trace = state.get("reasoning_trace") or []
        reasoning = trace[-1] if trace else (state.get("decision_reason") or "")
        proposal = Proposal(
            merchant_id=merchant_id,
            product_id=product_id,
            kind=ProposalKind.campaign,
            status=ProposalStatus.pending,
            reasoning=reasoning,
            payload=state["proposal_payload"],
            generated_assets=[],
        )
        db.add(proposal)
        await db.flush()
        state["proposal_id"] = proposal.id

    run = AgentRun(
        merchant_id=merchant_id,
        trigger=state.get("trigger", "manual"),
        state=_state_to_jsonable(state),
    )
    db.add(run)
    await db.flush()
    state["agent_run_id"] = run.id

    await db.commit()
    logger.info(
        "persist_proposal | decision=%s proposal_id=%s run_id=%s (took %.2fs)",
        decision,
        state.get("proposal_id"),
        run.id,
        time.perf_counter() - started,
    )

    # Kick-off de creatividades. Hacemos init SYNC para que la respuesta del
    # agente al frontend ya traiga los 5 placeholders en estado `generating` —
    # eso arranca el polling del front sin tener que recargar la página. La
    # generación pesada va en background con su propia AsyncSession.
    if decision == "propose" and state.get("proposal_id"):
        from app.services.image_gen import (
            init_assets_for_proposal,
            run_creative_generation,
        )

        proposal_id_for_task = state["proposal_id"]
        try:
            await init_assets_for_proposal(proposal_id_for_task)
        except Exception:
            logger.exception(
                "init_assets failed for proposal=%s",
                proposal_id_for_task,
            )
        else:
            async def _kick_off() -> None:
                try:
                    await run_creative_generation(proposal_id_for_task)
                except Exception:
                    logger.exception(
                        "background creative generation failed for proposal=%s",
                        proposal_id_for_task,
                    )

            asyncio.create_task(_kick_off())

    return state
