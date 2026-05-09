"""Métricas de ventas que alimentan el dashboard y, en la Capa 3, al agente."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Product, Sale
from app.schemas.sales import SalesSummaryRead


async def get_sales_summary(
    merchant_id: UUID, days: int, db: AsyncSession
) -> SalesSummaryRead:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    totals_row = (
        await db.execute(
            select(
                func.coalesce(func.sum(Sale.revenue), 0),
                func.coalesce(func.sum(Sale.quantity), 0),
            ).where(
                Sale.merchant_id == merchant_id,
                Sale.sold_at >= cutoff,
            )
        )
    ).one()
    total_revenue = Decimal(str(totals_row[0]))
    total_units = int(totals_row[1])

    top = (
        await db.execute(
            select(
                Product.id,
                Product.name,
                Product.image_urls,
                func.sum(Sale.quantity).label("units"),
            )
            .join(Sale, Sale.product_id == Product.id)
            .where(
                Sale.merchant_id == merchant_id,
                Sale.sold_at >= cutoff,
            )
            .group_by(Product.id, Product.name, Product.image_urls)
            .order_by(func.sum(Sale.quantity).desc())
            .limit(1)
        )
    ).first()

    top_image: str | None = None
    if top is not None and top.image_urls:
        top_image = top.image_urls[0] if len(top.image_urls) > 0 else None

    return SalesSummaryRead(
        total_revenue=total_revenue,
        total_units=total_units,
        top_product_id=top.id if top else None,
        top_product_name=top.name if top else None,
        top_product_units=int(top.units) if top else 0,
        top_product_image_url=top_image,
        period_days=days,
    )
