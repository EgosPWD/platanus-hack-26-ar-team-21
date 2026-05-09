"""Servicio que arma + envía + persiste las notificaciones de Vera por WhatsApp.

Cada función lee la propuesta + merchant, redacta el mensaje en la voz de Vera
(voseo argentino, primera persona), persiste un `Notification` con status
inicial `pending`, intenta enviar vía Evolution, y actualiza el status a
`sent` o `failed` según el resultado.

Si `merchant.whatsapp_phone` está vacío, deja la notificación en `failed` con
un mensaje claro y NO intenta enviar nada — esto evita perder el flujo
principal por una configuración incompleta del merchant.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import (
    Merchant,
    Notification,
    NotificationStatus,
    Product,
    Proposal,
)
from app.db.session import async_session_factory
from app.integrations import EvolutionClient

logger = logging.getLogger("vera.notifier")


# --- Helpers ----------------------------------------------------------------


async def _load_proposal_context(
    proposal_id: UUID, session: AsyncSession
) -> tuple[Proposal, Merchant, Product | None] | None:
    proposal = await session.get(Proposal, proposal_id)
    if proposal is None:
        return None
    merchant = await session.get(Merchant, proposal.merchant_id)
    if merchant is None:
        return None
    product: Product | None = None
    if proposal.product_id:
        product = await session.get(Product, proposal.product_id)
    return proposal, merchant, product


def _proposal_link(proposal_id: UUID) -> str:
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    return f"{base}/proposals/{proposal_id}"


def _make_client() -> EvolutionClient:
    if settings.USE_WHATSAPP_MOCK:
        return EvolutionClient()
    return EvolutionClient(
        api_url=settings.EVOLUTION_API_URL,
        api_key=settings.EVOLUTION_API_KEY,
        instance_name=settings.EVOLUTION_INSTANCE_NAME,
    )


async def _send_and_persist(
    *,
    merchant: Merchant,
    proposal: Proposal | None,
    kind: str,
    message: str,
) -> Notification:
    """Persiste una Notification y intenta enviarla. Devuelve la notification
    final con status sent/failed.

    Diseñada para correr desde un background task — abre y cierra su propia
    sesión.
    """
    async with async_session_factory() as session:
        notification = Notification(
            merchant_id=merchant.id,
            proposal_id=proposal.id if proposal else None,
            kind=kind,
            status=NotificationStatus.pending,
            channel="whatsapp",
            target_phone=merchant.whatsapp_phone,
            message_body=message,
        )
        session.add(notification)
        await session.commit()
        await session.refresh(notification)
        notification_id = notification.id

    if not merchant.whatsapp_phone:
        async with async_session_factory() as session:
            n = await session.get(Notification, notification_id)
            if n is not None:
                n.status = NotificationStatus.failed
                n.error_message = (
                    "El merchant no tiene whatsapp_phone configurado. "
                    "Setealo en la base o desde la API antes de notificar."
                )
                await session.commit()
                await session.refresh(n)
                logger.warning(
                    "notification | merchant=%s sin whatsapp_phone, kind=%s",
                    merchant.id,
                    kind,
                )
                return n

    try:
        async with _make_client() as client:
            await client.send_text(merchant.whatsapp_phone, message)
        ok = True
        err: str | None = None
    except Exception as exc:
        ok = False
        err = str(exc)[:500]
        logger.warning(
            "notification | send failed merchant=%s kind=%s err=%s",
            merchant.id,
            kind,
            err,
        )
    else:
        logger.info(
            "notification | sent merchant=%s kind=%s phone=%s",
            merchant.id,
            kind,
            merchant.whatsapp_phone,
        )

    async with async_session_factory() as session:
        n = await session.get(Notification, notification_id)
        if n is None:
            raise RuntimeError(
                f"notification {notification_id} desapareció — race?"
            )
        n.status = NotificationStatus.sent if ok else NotificationStatus.failed
        if ok:
            n.sent_at = datetime.now(timezone.utc)
        else:
            n.error_message = err
        await session.commit()
        await session.refresh(n)
        return n


# --- Funciones públicas — una por evento ------------------------------------


def _ready_message(business_name: str, product_name: str, link: str) -> str:
    return (
        f"Hola {business_name}, soy Vera 👋\n\n"
        f"Miré tus ventas y te dejé una propuesta para *{product_name}*. "
        "Generé 5 fotos profesionales.\n\n"
        f"Mirá las fotos y decime si te gustan: {link}\n\n"
        "_Vos siempre decidís._"
    )


def _approved_message(business_name: str, product_name: str) -> str:
    return (
        f"Listo {business_name}, aprobaste la propuesta para *{product_name}*. "
        "En cuanto activemos publicación, te aviso por acá.\n\n_Vera_"
    )


def _rejected_message(business_name: str, product_name: str) -> str:
    return (
        f"Anotado {business_name}. La propuesta para *{product_name}* queda "
        "descartada. Voy a seguir mirando tus ventas y te traigo otra cuando "
        "aparezca algo nuevo.\n\n_Vera_"
    )


async def notify_proposal_ready(proposal_id: UUID) -> Notification | None:
    async with async_session_factory() as session:
        ctx = await _load_proposal_context(proposal_id, session)
    if ctx is None:
        logger.warning("notify_proposal_ready | proposal %s no existe", proposal_id)
        return None
    proposal, merchant, product = ctx
    product_name = product.name if product else "tu producto top"
    message = _ready_message(merchant.business_name, product_name, _proposal_link(proposal_id))
    return await _send_and_persist(
        merchant=merchant,
        proposal=proposal,
        kind="proposal_ready",
        message=message,
    )


async def notify_proposal_approved(proposal_id: UUID) -> Notification | None:
    async with async_session_factory() as session:
        ctx = await _load_proposal_context(proposal_id, session)
    if ctx is None:
        return None
    proposal, merchant, product = ctx
    product_name = product.name if product else "esa propuesta"
    message = _approved_message(merchant.business_name, product_name)
    return await _send_and_persist(
        merchant=merchant,
        proposal=proposal,
        kind="proposal_approved_confirmation",
        message=message,
    )


async def notify_proposal_rejected(proposal_id: UUID) -> Notification | None:
    async with async_session_factory() as session:
        ctx = await _load_proposal_context(proposal_id, session)
    if ctx is None:
        return None
    proposal, merchant, product = ctx
    product_name = product.name if product else "esa propuesta"
    message = _rejected_message(merchant.business_name, product_name)
    return await _send_and_persist(
        merchant=merchant,
        proposal=proposal,
        kind="proposal_rejected_confirmation",
        message=message,
    )
