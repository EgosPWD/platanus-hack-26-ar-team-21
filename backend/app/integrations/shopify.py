"""Cliente real contra Shopify Admin API.

Usa httpx directo en vez de la SDK oficial (más simple, async-friendly y sin
dependencias adicionales). Para custom apps de development store, basta con el
header `X-Shopify-Access-Token`.
"""
import logging
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

API_VERSION = "2024-10"
DEFAULT_PAGE_LIMIT = 250


class ShopifyClient:
    def __init__(self, shop_domain: str, admin_token: str) -> None:
        if not shop_domain or not admin_token:
            raise ValueError(
                "ShopifyClient requiere shop_domain y admin_token "
                "(seteá SHOPIFY_SHOP_DOMAIN y SHOPIFY_ADMIN_TOKEN o "
                "USE_SHOPIFY_MOCK=true)"
            )
        normalized = shop_domain.replace("https://", "").replace("http://", "").rstrip("/")
        self.shop_domain = normalized
        self._client = httpx.AsyncClient(
            base_url=f"https://{normalized}/admin/api/{API_VERSION}",
            headers={
                "X-Shopify-Access-Token": admin_token,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=30.0,
        )

    async def __aenter__(self) -> "ShopifyClient":
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    async def close(self) -> None:
        await self._client.aclose()

    async def ping(self) -> bool:
        try:
            response = await self._client.get("/shop.json")
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("Shopify ping failed: %s", exc)
            return False
        return True

    async def list_products(self) -> list[dict[str, Any]]:
        response = await self._client.get(
            "/products.json", params={"limit": DEFAULT_PAGE_LIMIT}
        )
        response.raise_for_status()
        return response.json().get("products", [])

    async def list_orders(self, since: datetime | None = None) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"limit": DEFAULT_PAGE_LIMIT, "status": "any"}
        if since is not None:
            params["created_at_min"] = since.isoformat()
        response = await self._client.get("/orders.json", params=params)
        response.raise_for_status()
        return response.json().get("orders", [])
