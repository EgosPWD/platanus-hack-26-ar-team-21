"""Cliente real de OpenRouter para generación de imágenes con FLUX.2.

Usa el endpoint /chat/completions con `modalities: ["image"]`. La respuesta
llega bajo `choices[0].message.images[0].image_url.url`, que puede ser:
- una URL pública absoluta (`https://...`)
- un data URL base64 (`data:image/png;base64,...`)

`generate_image` devuelve `str` (URL) o `bytes` (decodeado del base64) y deja
que el caller decida cómo subirlo a Storage.

Image-to-image: si pasás `reference_image_url`, se manda como input multimodal
junto con el prompt. Si el modelo no soporta input multimodal, hace fallback
automático a text-only para no romper la corrida.
"""
from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

logger = logging.getLogger("vera.openrouter")

_OR_REFERER = "https://vera.platanus-hack-26.ar"
_OR_TITLE = "Vera"


class ImageGenerationError(Exception):
    """OpenRouter o FLUX devolvieron un error que impide producir la imagen."""


def _looks_like_unsupported_modality(message: str) -> bool:
    m = message.lower()
    return any(
        k in m
        for k in (
            "no endpoints found",
            "not support",
            "modalit",
            "unsupported input",
            "image input",
        )
    )


class OpenRouterImageClient:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model_id: str,
        timeout: float = 90.0,
    ) -> None:
        if not api_key:
            raise ValueError(
                "OpenRouterImageClient requiere api_key "
                "(seteá OPENROUTER_API_KEY o USE_OPENROUTER_MOCK=true)"
            )
        self.model_id = model_id
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": _OR_REFERER,
                "X-Title": _OR_TITLE,
            },
            timeout=timeout,
        )

    async def __aenter__(self) -> "OpenRouterImageClient":
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    async def close(self) -> None:
        await self._client.aclose()

    async def ping(self) -> bool:
        """GET /models — no consume crédito, valida solo credenciales."""
        try:
            response = await self._client.get("/models")
        except httpx.HTTPError as exc:
            logger.warning("OpenRouter ping HTTP error: %s", exc)
            return False
        return response.status_code == 200

    async def generate_image(
        self,
        prompt: str,
        reference_image_url: str | None = None,
        aspect_ratio: str = "1:1",
    ) -> str | bytes:
        """Genera una imagen — image-to-image si hay reference, text-to-image si no.

        Si el modelo no soporta input multimodal, cae automáticamente a text-only
        en la misma llamada. El caller no se entera salvo por el log.
        """
        del aspect_ratio  # placeholder por contrato

        if reference_image_url:
            multimodal_body = self._build_body(prompt, reference_image_url)
            try:
                return await self._post_and_parse(multimodal_body)
            except ImageGenerationError as exc:
                if _looks_like_unsupported_modality(str(exc)):
                    logger.warning(
                        "img2img no soportado por %s, fallback a text-only: %s",
                        self.model_id,
                        exc,
                    )
                else:
                    raise

        text_only_body = self._build_body(prompt, None)
        return await self._post_and_parse(text_only_body)

    # --- internals -------------------------------------------------------

    def _build_body(
        self, prompt: str, reference_image_url: str | None
    ) -> dict[str, Any]:
        if reference_image_url:
            content: Any = [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": reference_image_url}},
            ]
        else:
            content = prompt
        return {
            "model": self.model_id,
            "messages": [{"role": "user", "content": content}],
            "modalities": ["image"],
        }

    async def _post_and_parse(self, body: dict[str, Any]) -> str | bytes:
        try:
            response = await self._client.post("/chat/completions", json=body)
        except httpx.HTTPError as exc:
            raise ImageGenerationError(
                f"OpenRouter no respondió ({exc.__class__.__name__}: {exc})"
            ) from exc

        if response.status_code == 401:
            raise ImageGenerationError(
                "OpenRouter rechazó las credenciales (401). "
                "Revisá OPENROUTER_API_KEY."
            )
        if response.status_code == 402:
            raise ImageGenerationError(
                "OpenRouter sin saldo (402). Cargá créditos en openrouter.ai/credits."
            )
        if response.status_code == 429:
            raise ImageGenerationError(
                "OpenRouter rate limit (429). Esperá unos segundos y reintentá."
            )
        if response.status_code >= 500:
            raise ImageGenerationError(
                f"OpenRouter / proveedor con error {response.status_code}. "
                "Suele ser transitorio."
            )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise ImageGenerationError(
                f"HTTP {response.status_code}: {response.text[:300]}"
            ) from exc

        data = response.json()
        try:
            message = data["choices"][0]["message"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ImageGenerationError(
                f"Respuesta inesperada de OpenRouter: {data}"
            ) from exc

        images = message.get("images") or []
        if not images:
            content = message.get("content") or ""
            raise ImageGenerationError(
                f"FLUX no devolvió imagen. Mensaje del modelo: {str(content)[:300]}"
            )

        first = images[0]
        url_field = first.get("image_url") if isinstance(first, dict) else None
        if isinstance(url_field, dict):
            url = url_field.get("url", "")
        elif isinstance(first, dict):
            url = first.get("url", "")
        else:
            url = ""

        if not isinstance(url, str) or not url:
            raise ImageGenerationError(
                f"OpenRouter devolvió images sin url: {first}"
            )

        if url.startswith("data:"):
            try:
                _, b64_part = url.split(",", 1)
            except ValueError as exc:
                raise ImageGenerationError(
                    "data URL mal formado, no encontré la coma separadora"
                ) from exc
            try:
                return base64.b64decode(b64_part)
            except Exception as exc:
                raise ImageGenerationError(
                    f"data URL no decodeable: {exc}"
                ) from exc

        return url
