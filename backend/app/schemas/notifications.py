import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


NotificationStatusName = Literal["pending", "sent", "failed"]


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    merchant_id: uuid.UUID
    proposal_id: uuid.UUID | None
    kind: str
    status: NotificationStatusName
    channel: str
    target_phone: str | None
    message_body: str
    error_message: str | None = None
    sent_at: datetime | None = None
    created_at: datetime
