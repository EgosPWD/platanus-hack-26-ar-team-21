from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import CurrentMerchant, DbSession
from app.db.models import Sale
from app.schemas.sales import SaleRead, SalesSummaryRead
from app.services.analytics import get_sales_summary

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("", response_model=list[SaleRead])
async def list_sales(
    merchant: CurrentMerchant,
    db: DbSession,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[Sale]:
    rows = await db.execute(
        select(Sale)
        .where(Sale.merchant_id == merchant.id)
        .order_by(Sale.sold_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows.scalars().all())


@router.get("/summary", response_model=SalesSummaryRead)
async def sales_summary(
    merchant: CurrentMerchant,
    db: DbSession,
    days: int = Query(7, ge=1, le=365),
) -> SalesSummaryRead:
    return await get_sales_summary(merchant.id, days, db)
