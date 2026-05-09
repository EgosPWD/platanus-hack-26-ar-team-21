"""Mock de OpenRouter para Capa 4.

Devuelve URLs de Unsplash temáticamente coherentes según palabras del prompt.
Cada categoría tiene >= 12 URLs distintas para que las 5 variantes salgan
distintas y se puedan regenerar varias veces sin repetir.
"""
from __future__ import annotations

import logging
import random

logger = logging.getLogger("vera.openrouter.mock")

_UNSPLASH = "https://images.unsplash.com"
_PARAMS = "?auto=format&fit=crop&w=900&h=900"


def _u(photo_id: str) -> str:
    return f"{_UNSPLASH}/{photo_id}{_PARAMS}"


_BY_CATEGORY: dict[str, list[str]] = {
    "dress": [
        _u("photo-1572804013309-59a88b7e92f1"),
        _u("photo-1539109136881-3be0616acf4b"),
        _u("photo-1595777457583-95e059d581b8"),
        _u("photo-1564257631407-3deb25e4b3b8"),
        _u("photo-1566174053879-31528523f8ae"),
        _u("photo-1583846783214-7229a91b20ed"),
        _u("photo-1585487000160-6ebcfceb0d03"),
        _u("photo-1551488831-00ddcb6c6bd3"),
        _u("photo-1539008835657-9e8e9680c956"),
        _u("photo-1496747611176-843222e1e57c"),
        _u("photo-1469334031218-e382a71b716b"),
        _u("photo-1515886657613-9f3515b0c78f"),
    ],
    "tshirt": [
        _u("photo-1521572163474-6864f9cf17ab"),
        _u("photo-1583744946564-b52ac1c389c8"),
        _u("photo-1554568218-0f1715e72254"),
        _u("photo-1576566588028-4147f3842f27"),
        _u("photo-1503341504253-dff4815485f1"),
        _u("photo-1562157873-818bc0726f68"),
        _u("photo-1576566588028-4147f3842f27"),
        _u("photo-1581655353564-df123a1eb820"),
        _u("photo-1618354691373-d851c5c3a990"),
        _u("photo-1622519624072-2e3d8ebd4669"),
        _u("photo-1620799140188-3b2a02fd9a77"),
        _u("photo-1503342217505-b0a15ec3261c"),
    ],
    "jeans": [
        _u("photo-1542272604-787c3835535d"),
        _u("photo-1541099649105-f69ad21f3246"),
        _u("photo-1604176354204-9268737828e4"),
        _u("photo-1582418702059-97ebafb35d09"),
        _u("photo-1475178626620-a4d074967452"),
        _u("photo-1604176354204-9268737828e4"),
        _u("photo-1565084888279-aca607ecce0c"),
        _u("photo-1582552938357-32b906df40cb"),
        _u("photo-1473966968600-fa801b869a1a"),
        _u("photo-1473966968600-fa801b869a1a"),
        _u("photo-1551488831-00ddcb6c6bd3"),
        _u("photo-1602293589930-45aad59ba3ab"),
    ],
    "generic": [
        _u("photo-1483985988355-763728e1935b"),
        _u("photo-1490481651871-ab68de25d43d"),
        _u("photo-1492707892479-7bc8d5a4ee93"),
        _u("photo-1469334031218-e382a71b716b"),
        _u("photo-1515886657613-9f3515b0c78f"),
        _u("photo-1485518882345-15568b007407"),
        _u("photo-1507537509458-b8312d35a233"),
        _u("photo-1551803091-e20673f15770"),
        _u("photo-1502716119720-b23a93e5fe1b"),
        _u("photo-1567401893414-76b7b1e5a7a5"),
        _u("photo-1496747611176-843222e1e57c"),
        _u("photo-1574200060937-4e6d9aab7d8a"),
    ],
}


def _category_for(prompt: str) -> str:
    p = prompt.lower()
    if any(k in p for k in ("dress", "vestido")):
        return "dress"
    if any(k in p for k in ("t-shirt", "tshirt", "remera", "camiseta", "shirt")):
        return "tshirt"
    if any(k in p for k in ("jean", "pant", "trouser")):
        return "jeans"
    return "generic"


class OpenRouterImageClient:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model_id: str | None = None,
        timeout: float | None = None,
    ) -> None:
        # Todos los args son ignorados a propósito.
        self.model_id = model_id or "mock/flux"

    async def __aenter__(self) -> "OpenRouterImageClient":
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def close(self) -> None:
        return None

    async def ping(self) -> bool:
        return True

    async def generate_image(
        self,
        prompt: str,
        reference_image_url: str | None = None,
        aspect_ratio: str = "1:1",
    ) -> str | bytes:
        del aspect_ratio
        # Si llega una referencia, devolvemos esa misma URL para imitar el
        # comportamiento ideal del image-to-image (el "mismo producto" sale).
        if reference_image_url:
            logger.info("openrouter_mock | echoing reference image")
            return reference_image_url
        category = _category_for(prompt)
        choices = _BY_CATEGORY.get(category) or _BY_CATEGORY["generic"]
        url = random.choice(choices)
        logger.info("openrouter_mock | category=%s url=%s", category, url)
        return url
