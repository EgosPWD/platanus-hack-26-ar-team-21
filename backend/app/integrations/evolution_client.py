"""Cliente real de Evolution API para WhatsApp.

Evolution es la instancia self-hosted que usa el equipo. La API es REST y
autentica con un header `apikey`. Documentación de los endpoints relevantes:

- POST /message/sendText/{instance}    → texto plano
- POST /message/sendMedia/{instance}   → imagen / video / documento
- GET  /instance/connectionState/{instance} → 'open' = conectada

`send_text` y `send_media` levantan WhatsAppError si Evolution responde con
un status >=400, así el caller puede registrar la falla en la tabla
notifications con un mensaje útil.
"""
from __future__ import annotations

import logging
import re
from typing import Any

import httpx

logger = logging.getLogger("vera.whatsapp")


class WhatsAppError(Exception):
    """Evolution API rechazó el envío o no se pudo conectar."""


def normalize_phone(raw: str) -> str:
    """Normaliza un número a formato Evolution: solo dígitos, con código de país.

    - "+5493510000000"   → "5493510000000"
    - "5493510000000"    → "5493510000000"
    - "3510000000"       → "5493510000000"   (asume Argentina mobile)
    - "(0351) 555-1234"  → "543515551234" → "5493515551234"

    Si el resultado no llega a 10 dígitos, levanta ValueError.
    """
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        raise ValueError("phone vacío")

    digits = digits.lstrip("0")  # 0351... → 351...

    if not digits.startswith("54"):
        digits = "549" + digits
    elif len(digits) >= 12 and digits[2] != "9":
        # 54 + 10 dígitos sin el 9 mobile → insertamos.
        digits = "549" + digits[2:]

    if len(digits) < 10:
        raise ValueError(f"phone demasiado corto tras normalizar: {digits}")
    return digits


class EvolutionClient:
    def __init__(
        self,
        api_url: str,
        api_key: str,
        instance_name: str,
        timeout: float = 30.0,
    ) -> None:
        if not api_url or not api_key or not instance_name:
            raise ValueError(
                "EvolutionClient requiere api_url + api_key + instance_name "
                "(seteá las EVOLUTION_* o USE_WHATSAPP_MOCK=true)"
            )
        self.instance_name = instance_name
        self._client = httpx.AsyncClient(
            base_url=api_url.rstrip("/"),
            headers={
                "apikey": api_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=timeout,
        )

    async def __aenter__(self) -> "EvolutionClient":
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    async def close(self) -> None:
        await self._client.aclose()

    async def ping(self) -> bool:
        try:
            response = await self._client.get(
                f"/instance/connectionState/{self.instance_name}"
            )
        except httpx.HTTPError as exc:
            logger.warning("Evolution ping HTTP error: %s", exc)
            return False
        if response.status_code != 200:
            logger.warning(
                "Evolution ping non-200: %d %s",
                response.status_code,
                response.text[:200],
            )
            return False
        try:
            data = response.json()
        except Exception:
            return False
        # La forma del payload varía entre versiones — chequeamos varias rutas.
        state = (
            (data.get("instance") or {}).get("state")
            or data.get("state")
            or ""
        )
        return str(state).lower() == "open"

    async def send_text(self, to_number: str, text: str) -> dict[str, Any]:
        normalized = normalize_phone(to_number)
        body = {"number": normalized, "text": text}
        return await self._post(
            f"/message/sendText/{self.instance_name}", body
        )

    async def send_media(
        self,
        to_number: str,
        media_url: str,
        caption: str | None = None,
        mediatype: str = "image",
    ) -> dict[str, Any]:
        normalized = normalize_phone(to_number)
        body = {
            "number": normalized,
            "mediatype": mediatype,
            "media": media_url,
            "caption": caption or "",
        }
        return await self._post(
            f"/message/sendMedia/{self.instance_name}", body
        )

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await self._client.post(path, json=body)
        except httpx.HTTPError as exc:
            raise WhatsAppError(
                f"Evolution no respondió ({exc.__class__.__name__}: {exc})"
            ) from exc

        if response.status_code == 401 or response.status_code == 403:
            raise WhatsAppError(
                "Evolution rechazó las credenciales (revisá EVOLUTION_API_KEY)."
            )
        if response.status_code == 404:
            raise WhatsAppError(
                f"Evolution 404: instancia '{self.instance_name}' no existe "
                f"o no está creada."
            )
        if response.status_code >= 400:
            raise WhatsAppError(
                f"Evolution {response.status_code}: {response.text[:300]}"
            )

        try:
            return response.json()
        except Exception:
            return {"raw": response.text}
