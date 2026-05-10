"""Procesa mensajes entrantes de WhatsApp desde Evolution.

El contrato de Evolution cambia un poco entre versiones y eventos, por eso este
módulo extrae `phone` y `text` de varias rutas conocidas. La acción final queda
limitada a propuestas `pending`/`modified`: aprobar, rechazar o editar payload.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

from fastapi import HTTPException, status
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Merchant, Proposal, ProposalStatus
from app.integrations.evolution_client import normalize_phone
from app.services.notifier import notify_whatsapp_reply
from app.services.proposal_actions import (
    approve_proposal_for_merchant,
    modify_proposal_for_merchant,
    reject_proposal_for_merchant,
)

logger = logging.getLogger("vera.whatsapp.inbound")

InboundAction = Literal["approve", "reject", "modify", "help", "unknown"]


@dataclass
class IncomingWhatsAppMessage:
    phone: str
    text: str
    message_id: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class ParsedWhatsAppIntent(BaseModel):
    action: InboundAction
    changes: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None


def parse_evolution_message(payload: dict[str, Any]) -> IncomingWhatsAppMessage | None:
    """Extrae teléfono y texto de eventos comunes de Evolution."""
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    if not isinstance(data, dict):
        return None

    if data.get("fromMe") is True or (data.get("key") or {}).get("fromMe") is True:
        return None

    remote = (
        _dig(data, "key", "remoteJid")
        or data.get("remoteJid")
        or data.get("sender")
        or data.get("from")
        or data.get("number")
        or _dig(payload, "sender")
    )
    text = _extract_text(data) or _extract_text(payload)
    if not remote or not text:
        return None

    phone = str(remote).split("@", 1)[0]
    try:
        normalized = normalize_phone(phone if phone.startswith("+") else f"+{phone}")
    except ValueError:
        normalized = re.sub(r"\D", "", phone)
    if not normalized:
        return None

    message_id = (
        _dig(data, "key", "id")
        or data.get("id")
        or payload.get("id")
    )
    return IncomingWhatsAppMessage(
        phone=normalized,
        text=str(text).strip(),
        message_id=str(message_id) if message_id else None,
        raw=payload,
    )


def _dig(root: dict[str, Any], *path: str) -> Any:
    cur: Any = root
    for key in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def _extract_text(root: dict[str, Any]) -> str | None:
    message = root.get("message") if isinstance(root.get("message"), dict) else {}
    candidates = [
        root.get("text"),
        root.get("body"),
        root.get("messageText"),
        message.get("conversation"),
        _dig(message, "extendedTextMessage", "text"),
        _dig(message, "ephemeralMessage", "message", "conversation"),
        _dig(message, "ephemeralMessage", "message", "extendedTextMessage", "text"),
    ]
    for value in candidates:
        if isinstance(value, str) and value.strip():
            return value
        if isinstance(value, dict):
            nested = value.get("text") or value.get("body")
            if isinstance(nested, str) and nested.strip():
                return nested
    return None


async def handle_incoming_whatsapp(
    db: AsyncSession, payload: dict[str, Any]
) -> dict[str, Any]:
    incoming = parse_evolution_message(payload)
    if incoming is None:
        return {"status": "ignored", "reason": "no inbound text message"}

    merchant = await _merchant_by_phone(db, incoming.phone)
    if merchant is None:
        logger.warning("whatsapp inbound | unknown phone=%s", incoming.phone)
        return {"status": "ignored", "reason": "merchant not found"}

    proposal = await _target_proposal(db, merchant.id, incoming.text)
    if proposal is None:
        await notify_whatsapp_reply(
            merchant=merchant,
            proposal=None,
            kind="whatsapp_no_pending_proposal",
            message=(
                f"Hola {merchant.business_name}, no encontré una propuesta pendiente "
                "para responder. Entrá al dashboard y revisamos desde ahí."
            ),
        )
        return {"status": "no_pending_proposal", "merchant_id": str(merchant.id)}

    intent = await parse_intent_with_ai(incoming.text, proposal.payload or {})
    try:
        if intent.action == "approve":
            await approve_proposal_for_merchant(
                db,
                merchant_id=merchant.id,
                proposal_id=proposal.id,
                notes=intent.notes or "Aprobada desde WhatsApp.",
                send_decision_notification=False,
            )
            await notify_whatsapp_reply(
                merchant=merchant,
                proposal=proposal,
                kind="whatsapp_approved",
                message=(
                    "Listo, aprobé la propuesta desde WhatsApp. "
                    "Ahora creo la campaña en Meta y la dejo pausada para tu último OK."
                ),
            )
        elif intent.action == "reject":
            await reject_proposal_for_merchant(
                db,
                merchant_id=merchant.id,
                proposal_id=proposal.id,
                notes=intent.notes or "Rechazada desde WhatsApp.",
                send_decision_notification=False,
            )
            await notify_whatsapp_reply(
                merchant=merchant,
                proposal=proposal,
                kind="whatsapp_rejected",
                message="Listo, la dejé rechazada. Sigo mirando tus ventas para la próxima oportunidad.",
            )
        elif intent.action == "modify":
            await modify_proposal_for_merchant(
                db,
                merchant_id=merchant.id,
                proposal_id=proposal.id,
                changes=intent.changes,
            )
            await notify_whatsapp_reply(
                merchant=merchant,
                proposal=proposal,
                kind="whatsapp_modified",
                message=(
                    "Listo, actualicé la propuesta. Si te cierra, respondé "
                    "*aprobar*. Si no, pedime otro cambio."
                ),
            )
        else:
            await notify_whatsapp_reply(
                merchant=merchant,
                proposal=proposal,
                kind="whatsapp_help",
                message=_help_message(),
            )
    except HTTPException as exc:
        await notify_whatsapp_reply(
            merchant=merchant,
            proposal=proposal,
            kind="whatsapp_action_failed",
            message=f"No pude aplicar eso: {exc.detail}",
        )
        raise

    return {
        "status": "ok",
        "merchant_id": str(merchant.id),
        "proposal_id": str(proposal.id),
        "action": intent.action,
        "changes": intent.changes,
    }


async def _merchant_by_phone(db: AsyncSession, incoming_phone: str) -> Merchant | None:
    merchants = (
        await db.execute(select(Merchant).where(Merchant.whatsapp_phone.is_not(None)))
    ).scalars().all()
    for merchant in merchants:
        try:
            stored = normalize_phone(merchant.whatsapp_phone or "")
        except ValueError:
            stored = re.sub(r"\D", "", merchant.whatsapp_phone or "")
        if stored == incoming_phone:
            return merchant
    return None


async def _target_proposal(
    db: AsyncSession, merchant_id: uuid.UUID, text: str
) -> Proposal | None:
    explicit_id = _extract_uuid(text)
    if explicit_id:
        proposal = (
            await db.execute(
                select(Proposal).where(
                    Proposal.id == explicit_id,
                    Proposal.merchant_id == merchant_id,
                    Proposal.status.in_([ProposalStatus.pending, ProposalStatus.modified]),
                )
            )
        ).scalar_one_or_none()
        if proposal is not None:
            return proposal

    return (
        await db.execute(
            select(Proposal)
            .where(
                Proposal.merchant_id == merchant_id,
                Proposal.status.in_([ProposalStatus.pending, ProposalStatus.modified]),
            )
            .order_by(desc(Proposal.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()


def _extract_uuid(text: str) -> uuid.UUID | None:
    match = re.search(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        text,
    )
    if not match:
        return None
    try:
        return uuid.UUID(match.group(0))
    except ValueError:
        return None


async def parse_intent_with_ai(text: str, current_payload: dict[str, Any]) -> ParsedWhatsAppIntent:
    deterministic = _parse_deterministic(text)
    if deterministic.action != "unknown" or not settings.ANTHROPIC_API_KEY:
        return deterministic

    prompt = (
        "Interpretá un mensaje de WhatsApp de un merchant que responde una propuesta "
        "de campaña. Devolvé SOLO JSON válido con esta forma: "
        '{"action":"approve|reject|modify|help|unknown","changes":{},"notes":null}. '
        "Para modificar, usá solo estas llaves: copy_es, audience_hint, "
        "suggested_budget_ars, creative_brief. No inventes campos. "
        f"Payload actual: {json.dumps(current_payload, ensure_ascii=False)}"
    )
    try:
        llm = ChatAnthropic(
            model=settings.AGENT_MODEL,
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=0,
            max_tokens=300,
        )
        response = await llm.ainvoke(
            [
                SystemMessage(content=prompt),
                HumanMessage(content=text),
            ]
        )
        raw = str(response.content or "").strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = ParsedWhatsAppIntent.model_validate_json(raw)
        return _sanitize_intent(parsed)
    except (ValidationError, json.JSONDecodeError, Exception):
        logger.exception("whatsapp intent AI parse failed")
        return ParsedWhatsAppIntent(action="help")


def _parse_deterministic(text: str) -> ParsedWhatsAppIntent:
    lower = text.strip().lower()
    if lower in {"si", "sí", "ok", "dale", "aprobar", "aprobá", "acepto", "aceptar", "va"}:
        return ParsedWhatsAppIntent(action="approve")
    if lower in {"no", "rechazar", "rechazá", "negar", "cancelar", "descartar"}:
        return ParsedWhatsAppIntent(action="reject")
    if lower in {"ayuda", "help", "comandos"}:
        return ParsedWhatsAppIntent(action="help")

    changes: dict[str, Any] = {}
    budget = re.search(r"(?:presupuesto|budget)\D+(\d[\d\.\,]*)", lower)
    if budget:
        value = int(re.sub(r"\D", "", budget.group(1)))
        if value > 0:
            changes["suggested_budget_ars"] = value

    for key, aliases in {
        "copy_es": ["copy", "texto", "mensaje"],
        "audience_hint": ["audiencia", "público", "publico"],
        "creative_brief": ["brief", "creatividad", "foto", "imagen"],
    }.items():
        for alias in aliases:
            match = re.search(rf"{alias}\s*[:=]\s*(.+)", text, flags=re.IGNORECASE)
            if match:
                changes[key] = match.group(1).strip()
                break

    if changes:
        return ParsedWhatsAppIntent(action="modify", changes=changes)
    return ParsedWhatsAppIntent(action="unknown")


def _sanitize_intent(intent: ParsedWhatsAppIntent) -> ParsedWhatsAppIntent:
    allowed = {"copy_es", "audience_hint", "suggested_budget_ars", "creative_brief"}
    changes = {k: v for k, v in intent.changes.items() if k in allowed}
    if "suggested_budget_ars" in changes:
        try:
            changes["suggested_budget_ars"] = int(changes["suggested_budget_ars"])
        except (TypeError, ValueError):
            changes.pop("suggested_budget_ars", None)
    if intent.action == "modify" and not changes:
        return ParsedWhatsAppIntent(action="help")
    return ParsedWhatsAppIntent(action=intent.action, changes=changes, notes=intent.notes)


def _help_message() -> str:
    return (
        "Podés responderme así:\n"
        "- *aprobar* para aceptar y crear la campaña en Meta pausada.\n"
        "- *rechazar* para descartarla.\n"
        "- *presupuesto 15000* para cambiar presupuesto.\n"
        "- *copy: nuevo texto* para cambiar el anuncio.\n"
        "- *audiencia: mujeres 25-40 en Córdoba* para cambiar público."
    )
