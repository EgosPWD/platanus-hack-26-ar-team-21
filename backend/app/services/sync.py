"""Sincronización de catálogo y ventas desde Shopify (real o mock)."""
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Merchant, Product, Sale
from app.integrations import ShopifyClient
from app.schemas.integrations import ShopifySyncResult

logger = logging.getLogger(__name__)

ORDERS_LOOKBACK_DAYS = 30


def _credentials_for(merchant: Merchant) -> tuple[str, str]:
    """Credenciales por-merchant con fallback a las globales del .env."""
    domain = merchant.shopify_shop_domain or settings.SHOPIFY_SHOP_DOMAIN
    token = merchant.shopify_access_token or settings.SHOPIFY_ADMIN_TOKEN
    return domain, token


def _parse_decimal(raw: object, default: str = "0") -> Decimal:
    try:
        return Decimal(str(raw))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _parse_datetime(raw: object) -> datetime:
    if isinstance(raw, datetime):
        return raw
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(timezone.utc)


async def sync_shopify_catalog(
    merchant_id: UUID, db: AsyncSession
) -> ShopifySyncResult:
    """Trae productos y órdenes de Shopify y upsertea en DB.

    - Productos: match por (merchant_id, external_id), upsert.
    - Ventas: match por (merchant_id, external_order_id, product_id) — no duplica.
    - Si la integración real falla, captura la excepción y devuelve errores.
    """
    merchant = (
        await db.execute(select(Merchant).where(Merchant.id == merchant_id))
    ).scalar_one_or_none()
    if merchant is None:
        return ShopifySyncResult(errors=[f"Merchant {merchant_id} no existe"])

    domain, token = _credentials_for(merchant)
    integration_status = "mock" if settings.USE_SHOPIFY_MOCK else "ok"
    errors: list[str] = []

    try:
        async with ShopifyClient(shop_domain=domain, admin_token=token) as client:
            since = datetime.now(timezone.utc) - timedelta(days=ORDERS_LOOKBACK_DAYS)
            shopify_products = await client.list_products()
            shopify_orders = await client.list_orders(since=since)
    except Exception as exc:
        logger.exception("Shopify sync failed for merchant %s", merchant_id)
        return ShopifySyncResult(
            errors=[f"Shopify: {exc}"],
            integration_status="real_failed_using_cache",
        )

    now = datetime.now(timezone.utc)
    external_to_product: dict[str, Product] = {}
    synced_products = 0

    for raw in shopify_products:
        external_id = str(raw.get("id"))
        if not external_id or external_id == "None":
            continue

        existing = (
            await db.execute(
                select(Product).where(
                    Product.merchant_id == merchant_id,
                    Product.external_id == external_id,
                )
            )
        ).scalar_one_or_none()

        variants = raw.get("variants") or []
        first_price = variants[0].get("price") if variants else "0"
        price = _parse_decimal(first_price)
        images = [
            img.get("src")
            for img in (raw.get("images") or [])
            if img.get("src")
        ]
        attrs = {"product_type": raw.get("product_type")}

        if existing is None:
            product = Product(
                merchant_id=merchant_id,
                external_id=external_id,
                name=raw.get("title") or "Sin nombre",
                description=raw.get("body_html"),
                price=price,
                category=raw.get("product_type"),
                image_urls=images,
                attributes=attrs,
                is_active=True,
                last_synced_at=now,
            )
            db.add(product)
            await db.flush()
            external_to_product[external_id] = product
        else:
            existing.name = raw.get("title") or existing.name
            existing.description = raw.get("body_html")
            existing.price = price
            existing.category = raw.get("product_type")
            existing.image_urls = images
            existing.attributes = attrs
            existing.last_synced_at = now
            external_to_product[external_id] = existing

        synced_products += 1

    synced_sales = 0
    for raw in shopify_orders:
        order_id = str(raw.get("id"))
        sold_at = _parse_datetime(raw.get("created_at"))

        for line in raw.get("line_items") or []:
            product_external_id = str(line.get("product_id"))
            product = external_to_product.get(product_external_id)
            if product is None:
                # Línea de un producto que no está en el catálogo del merchant: ignorar.
                continue
            quantity = int(line.get("quantity") or 0)
            if quantity <= 0:
                continue
            line_price = _parse_decimal(line.get("price"))
            revenue = line_price * quantity

            existing_sale = (
                await db.execute(
                    select(Sale).where(
                        Sale.merchant_id == merchant_id,
                        Sale.external_order_id == order_id,
                        Sale.product_id == product.id,
                    )
                )
            ).scalar_one_or_none()
            if existing_sale is not None:
                continue

            db.add(
                Sale(
                    merchant_id=merchant_id,
                    product_id=product.id,
                    external_order_id=order_id,
                    quantity=quantity,
                    revenue=revenue,
                    sold_at=sold_at,
                )
            )
            synced_sales += 1

    await db.commit()
    return ShopifySyncResult(
        synced_products=synced_products,
        synced_sales=synced_sales,
        errors=errors,
        integration_status=integration_status,
    )
