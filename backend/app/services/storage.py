"""Wrapper de Supabase Storage para los creativos generados por FLUX.2.

Tres entradas posibles:
- URL pública (caso típico de OpenRouter "image_url" no embebido)
- bytes crudos (típico de data URL base64 ya decodificados)
- base64 string (data URL crudo)

Todas terminan en: bytes → bucket "vera-creatives" → URL pública estable.
"""
import asyncio
import base64
import logging
from typing import Final

import httpx
from supabase import Client, create_client

from app.core.config import settings

logger = logging.getLogger("vera.storage")

_DEFAULT_CONTENT_TYPE: Final[str] = "image/png"
_DOWNLOAD_TIMEOUT_S: Final[float] = 30.0


def _supabase_client() -> Client:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise RuntimeError(
            "Supabase Storage requiere SUPABASE_URL + SUPABASE_SERVICE_KEY en .env"
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def _public_url(dest_path: str) -> str:
    """Construimos la URL pública sin usar `get_public_url` para evitar diferencias
    entre versiones del SDK (algunas devuelven dict, otras string)."""
    base = settings.SUPABASE_URL.rstrip("/")
    bucket = settings.SUPABASE_STORAGE_BUCKET
    return f"{base}/storage/v1/object/public/{bucket}/{dest_path.lstrip('/')}"


async def upload_image_from_bytes(
    image_bytes: bytes,
    dest_path: str,
    content_type: str = _DEFAULT_CONTENT_TYPE,
) -> str:
    """Sube los bytes a Supabase Storage y devuelve la URL pública.

    Usa upsert para que regenerar pisar la imagen vieja sin error.
    """

    def _do() -> str:
        client = _supabase_client()
        bucket = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET)
        bucket.upload(
            path=dest_path,
            file=image_bytes,
            file_options={
                "content-type": content_type,
                "upsert": "true",
            },
        )
        return _public_url(dest_path)

    return await asyncio.to_thread(_do)


async def upload_image_from_base64(
    b64_data: str,
    dest_path: str,
    content_type: str = _DEFAULT_CONTENT_TYPE,
) -> str:
    raw = base64.b64decode(b64_data)
    return await upload_image_from_bytes(raw, dest_path, content_type)


async def upload_image_from_url(source_url: str, dest_path: str) -> str:
    """Descarga `source_url` (siguiendo redirects) y la sube al bucket."""
    async with httpx.AsyncClient(timeout=_DOWNLOAD_TIMEOUT_S, follow_redirects=True) as c:
        response = await c.get(source_url)
        response.raise_for_status()
    content_type = response.headers.get("content-type", _DEFAULT_CONTENT_TYPE)
    # Algunos CDN devuelven "image/jpeg; charset=binary" — quedate solo con el MIME.
    content_type = content_type.split(";", 1)[0].strip() or _DEFAULT_CONTENT_TYPE
    return await upload_image_from_bytes(response.content, dest_path, content_type)
