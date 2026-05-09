import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SaleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    merchant_id: uuid.UUID
    product_id: uuid.UUID
    external_order_id: str
    quantity: int
    revenue: Decimal
    sold_at: datetime


class SalesSummaryRead(BaseModel):
    total_revenue: Decimal
    total_units: int
    top_product_id: uuid.UUID | None
    top_product_name: str | None
    top_product_units: int
    top_product_image_url: str | None = None
    period_days: int
