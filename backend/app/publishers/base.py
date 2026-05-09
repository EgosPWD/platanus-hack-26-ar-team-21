"""Interfaz común para todos los publishers (Meta, Google Ads, etc.).

Un Publisher toma una `Proposal` aprobada y la traduce a la creación real
en la plataforma externa, persistiendo una `Campaign` en DB.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Campaign, Proposal


class PublisherResult(BaseModel):
    success: bool
    external_id: str | None = None
    external_url: str | None = None
    error: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class Publisher(ABC):
    @abstractmethod
    async def publish(
        self, proposal: Proposal, db: AsyncSession
    ) -> PublisherResult:
        """Ejecuta la creación. Persiste un Campaign en DB.

        Convención: si falla, persiste igual un Campaign con status='failed'
        + error_message, así el front puede mostrar el motivo y ofrecer un
        retry.
        """

    @abstractmethod
    async def fetch_status(self, campaign: Campaign) -> dict[str, Any]:
        """Sincroniza el estado actual desde la plataforma. Devuelve el dict
        crudo de la plataforma — el caller decide qué hacer con eso."""
