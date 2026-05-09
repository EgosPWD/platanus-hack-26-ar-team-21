"""Mock de Shopify con la misma interfaz que el cliente real.

Devuelve un catálogo fijo (la "Tienda de Ana") y un patrón de ventas con un
ganador claro: el vestido rojo (8 unidades en 7 días). Esto le da al agente
de la Capa 3 una señal limpia para detectar el top seller.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

# IDs estables — el sync upsertea por (merchant_id, external_id), así que tienen
# que mantenerse entre corridas para no duplicar productos.
_PRODUCTS: list[dict[str, Any]] = [
    {
        "id": 1001,
        "title": "Vestido rojo de gasa",
        "body_html": "Vestido midi en gasa roja, perfecto para tardes de primavera.",
        "product_type": "Vestidos",
        "variants": [{"price": "18900.00", "sku": "VES-RED-M"}],
        "images": [
            {
                "src": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&h=800"
            }
        ],
    },
    {
        "id": 1002,
        "title": "Vestido azul liso",
        "body_html": "Vestido corto azul, tela fluida, ideal para eventos casuales.",
        "product_type": "Vestidos",
        "variants": [{"price": "16500.00", "sku": "VES-BLU-M"}],
        "images": [
            {
                "src": "https://images.unsplash.com/photo-1564257631407-3deb25e4b3b8?auto=format&fit=crop&w=800&h=800"
            }
        ],
    },
    {
        "id": 1003,
        "title": "Vestido negro clásico",
        "body_html": "El infaltable: pequeño vestido negro, calce ajustado.",
        "product_type": "Vestidos",
        "variants": [{"price": "21000.00", "sku": "VES-BLK-M"}],
        "images": [
            {
                "src": "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&h=800"
            }
        ],
    },
    {
        "id": 2001,
        "title": "Remera blanca lisa",
        "body_html": "Algodón pima, calce holgado.",
        "product_type": "Remeras",
        "variants": [{"price": "8500.00", "sku": "REM-WHT-M"}],
        "images": [
            {
                "src": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&h=800"
            }
        ],
    },
    {
        "id": 2002,
        "title": "Remera estampada flores",
        "body_html": "Estampa floral artesanal sobre algodón.",
        "product_type": "Remeras",
        "variants": [{"price": "9800.00", "sku": "REM-FLR-M"}],
        "images": [
            {
                "src": "https://images.unsplash.com/photo-1554568218-0f1715e72254?auto=format&fit=crop&w=800&h=800"
            }
        ],
    },
    {
        "id": 3001,
        "title": "Jean tiro alto mom fit",
        "body_html": "Lavado claro, tiro alto, calce relajado.",
        "product_type": "Pantalones",
        "variants": [{"price": "24500.00", "sku": "JEN-MOM-28"}],
        "images": [
            {
                "src": "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&h=800"
            }
        ],
    },
]

# (product_id, units) — patrón con un ganador claro.
_SALES_PATTERN: list[tuple[int, int]] = [
    (1001, 8),  # vestido rojo — top seller
    (1002, 3),
    (1003, 1),
    (2001, 2),
    (2002, 2),
    (3001, 1),
]
_TOTAL_UNITS = sum(units for _, units in _SALES_PATTERN)


class ShopifyClient:
    def __init__(
        self,
        shop_domain: str | None = None,
        admin_token: str | None = None,
    ) -> None:
        # En el mock estos parámetros se ignoran adrede.
        self.shop_domain = shop_domain or "ana-store.myshopify.com"
        self.admin_token = admin_token or "shpat_mock"

    async def __aenter__(self) -> "ShopifyClient":
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def close(self) -> None:
        return None

    async def ping(self) -> bool:
        return True

    async def list_products(self) -> list[dict[str, Any]]:
        # Devolvemos copias para que el caller no pueda mutar el catálogo en memoria.
        return [dict(p) for p in _PRODUCTS]

    async def list_orders(self, since: datetime | None = None) -> list[dict[str, Any]]:
        now = datetime.now(timezone.utc)
        # Distribuimos las ventas a lo largo de los últimos 7 días con paso uniforme.
        minutes_window = 7 * 24 * 60
        step = max(minutes_window // max(_TOTAL_UNITS, 1), 1)

        orders: list[dict[str, Any]] = []
        order_id = 90000
        offset_minutes = 0

        for product_id, units in _SALES_PATTERN:
            price = next(
                p["variants"][0]["price"] for p in _PRODUCTS if p["id"] == product_id
            )
            for _ in range(units):
                sold_at = now - timedelta(minutes=offset_minutes)
                offset_minutes += step
                if since is not None and sold_at < since:
                    continue
                orders.append(
                    {
                        "id": order_id,
                        "created_at": sold_at.isoformat(),
                        "line_items": [
                            {
                                "product_id": product_id,
                                "quantity": 1,
                                "price": price,
                            }
                        ],
                    }
                )
                order_id += 1

        return orders
