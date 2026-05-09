import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ProductSnapshot(BaseModel):
    """Mini-payload del producto, embebido dentro de la propuesta."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    price: Decimal
    image_urls: list[str] = Field(default_factory=list)
    category: str | None = None


class ProposalPayload(BaseModel):
    """Lo que el agente compone para una campaña."""

    copy_es: str = Field(
        max_length=140,
        description="Texto del anuncio en español, voseo, con CTA.",
    )
    audience_hint: str = Field(
        description="A quién apuntar, en una frase.",
    )
    suggested_budget_ars: int = Field(
        ge=5000,
        le=30000,
        description="Presupuesto sugerido en pesos argentinos.",
    )
    creative_brief: str = Field(
        description="Brief para la generación de imágenes (Capa 4).",
    )


AssetStatus = Literal["generating", "ready", "failed"]


class GeneratedAsset(BaseModel):
    """Cada uno de los N creativos generados para una propuesta.

    El campo `prompt_used` es deliberadamente expuesto en la API: en el demo
    queremos poder mostrarle al juez cómo "piensa" Vera al armar la creatividad.
    """

    id: str
    variant_index: int
    variant_name: str
    prompt_used: str
    status: AssetStatus
    url: str | None = None
    content_type: str | None = None
    error_message: str | None = None
    created_at: datetime


class ProposalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    merchant_id: uuid.UUID
    product_id: uuid.UUID | None
    kind: Literal["campaign", "creative_refresh", "budget_change"]
    status: Literal["pending", "approved", "rejected", "modified"]
    reasoning: str
    payload: dict[str, Any] = Field(default_factory=dict)
    generated_assets: list[GeneratedAsset] = Field(default_factory=list)
    created_at: datetime
    decided_at: datetime | None = None

    product: ProductSnapshot | None = None


class ProposalDecision(BaseModel):
    """Patch que el frontend manda para aprobar/rechazar/modificar."""

    status: Literal["approved", "rejected", "modified"]
    notes: str | None = None


class AgentRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    merchant_id: uuid.UUID
    trigger: str
    state: dict[str, Any]
    created_at: datetime


class AgentRunResult(BaseModel):
    """Devuelto por POST /proposals/run.

    Si el agente decidió `skip`, `proposal` es None y `decision_reason` explica
    por qué. Si decidió `propose`, `proposal` trae la propuesta recién creada.
    """

    decision: Literal["propose", "skip"]
    decision_reason: str
    proposal: ProposalRead | None = None
    reasoning_trace: list[str] = Field(default_factory=list)
    agent_run_id: uuid.UUID | None = None
    error: str | None = None
