import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    name: str
    description: str | None = None
    price: Decimal = Field(default=Decimal("0"))
    category: str | None = None
    image_urls: list[str] = Field(default_factory=list)
    attributes: dict = Field(default_factory=dict)
    is_active: bool = True


class ProductCreate(ProductBase):
    external_id: str


class ProductRead(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    merchant_id: uuid.UUID
    external_id: str
    last_synced_at: datetime | None = None
