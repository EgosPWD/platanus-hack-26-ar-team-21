"""Mock de Evolution: loguea los mensajes en consola en vez de enviarlos.

Útil para validar el flujo end-to-end (qué se enviaría) sin gastar mensajes
en la instancia real ni molestar al equipo con WhatsApps de prueba.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("vera.whatsapp.mock")


class WhatsAppError(Exception):
    """Mantenida para que el caller no se entere de la diferencia."""


class EvolutionClient:
    def __init__(
        self,
        api_url: str | None = None,
        api_key: str | None = None,
        instance_name: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.instance_name = instance_name or "mock"

    async def __aenter__(self) -> "EvolutionClient":
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def close(self) -> None:
        return None

    async def ping(self) -> bool:
        return True

    async def send_text(self, to_number: str, text: str) -> dict[str, Any]:
        logger.info("[WHATSAPP MOCK -> %s]\n%s\n", to_number, text)
        return {"success": True, "mock": True, "to": to_number}

    async def send_media(
        self,
        to_number: str,
        media_url: str,
        caption: str | None = None,
        mediatype: str = "image",
    ) -> dict[str, Any]:
        logger.info(
            "[WHATSAPP MOCK -> %s] [%s: %s] %s",
            to_number,
            mediatype,
            media_url,
            caption or "",
        )
        return {"success": True, "mock": True, "to": to_number}
