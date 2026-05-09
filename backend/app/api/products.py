import logging

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.deps import CurrentMerchant, DbSession
from app.db.models import Product
from app.schemas.integrations import ShopifySyncResult
from app.schemas.products import ProductRead
from app.services.sync import sync_shopify_catalog

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductRead])
async def list_products(
    merchant: CurrentMerchant,
    db: DbSession,
    limit: int = Query(50, ge=1, le=250),
    offset: int = Query(0, ge=0),
) -> list[Product]:
    rows = await db.execute(
        select(Product)
        .where(Product.merchant_id == merchant.id, Product.is_active.is_(True))
        .order_by(Product.name)
        .limit(limit)
        .offset(offset)
    )
    return list(rows.scalars().all())


@router.post("/sync", response_model=ShopifySyncResult)
async def sync_products(
    merchant: CurrentMerchant,
    db: DbSession,
) -> ShopifySyncResult:
    """Sincroniza catálogo y ventas desde Shopify.

    Si la integración real falla y hay catálogo previo en DB, devuelve un
    resultado con `integration_status = "real_failed_using_cache"` y los
    productos viejos quedan disponibles. Si no hay nada en cache, 503.
    """
    try:
        result = await sync_shopify_catalog(merchant.id, db)
    except Exception as exc:
        logger.exception("Sync products failed for merchant %s", merchant.id)
        product_count = (
            await db.execute(
                select(func.count(Product.id)).where(Product.merchant_id == merchant.id)
            )
        ).scalar_one()
        if product_count == 0:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Shopify no respondió y no hay catálogo en cache: {exc}",
            ) from exc
        return ShopifySyncResult(
            errors=[f"sync_failed: {exc}"],
            integration_status="real_failed_using_cache",
        )
    return result
