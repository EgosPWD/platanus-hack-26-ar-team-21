import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MerchantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    business_name: str
    whatsapp_phone: str | None
    currency: str
    shopify_trigger_every_n_orders: int
    created_at: datetime
