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
    created_at: datetime
