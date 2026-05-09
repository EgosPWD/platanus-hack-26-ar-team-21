"""Schemas Pydantic para campañas (Capa 6)."""
import enum
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CampaignKind(str, enum.Enum):
    meta_ads = "meta_ads"
    google_ads = "google_ads"
    whatsapp_broadcast = "whatsapp_broadcast"


class CampaignStatusEnum(str, enum.Enum):
    """Status del lifecycle de la campaña dentro de Vera.

    `creating`/`failed` cubren el momento entre que el merchant aprobó y la
    integración respondió. `created` significa "ya existe en Meta, en pausa,
    lista para que el merchant la active". `active`/`paused`/`finished` reflejan
    el estado consultado contra Meta una vez creada.
    """

    pending = "pending"
    creating = "creating"
    created = "created"
    failed = "failed"
    active = "active"
    paused = "paused"
    finished = "finished"


class CampaignMetrics(BaseModel):
    """Placeholder de métricas — Capa 6 no las trae todavía, pero dejamos el
    schema listo para Capa 7+."""

    impressions: int | None = None
    clicks: int | None = None
    reach: int | None = None
    ctr: float | None = None


class CampaignRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    merchant_id: uuid.UUID
    proposal_id: uuid.UUID
    kind: CampaignKind = CampaignKind.meta_ads
    status: CampaignStatusEnum
    publisher: str
    external_id: str | None = None
    external_url: str | None = None
    creative_count: int = 0
    budget_ars: int | None = None
    error_message: str | None = None
    payload_snapshot: dict[str, Any] = Field(default_factory=dict)
    metrics: CampaignMetrics = Field(default_factory=CampaignMetrics)
    created_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    last_synced_at: datetime | None = None
    # Snapshot mínimo del producto para mostrar en la UI sin un join extra.
    product_name: str | None = None
    product_image_url: str | None = None
