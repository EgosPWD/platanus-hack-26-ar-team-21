from typing import Literal

from pydantic import BaseModel, Field


# Estados estructurados de respuesta para endpoints que llaman a integraciones reales
# (ver CLAUDE.md §11 — plan de rollback). "ok" = corrió contra la integración.
# "mock" = corrió contra la versión mock (toggle activo). "real_failed_using_cache" =
# la integración real falló pero hay datos previos en DB que se devuelven igual.
IntegrationStatus = Literal["ok", "mock", "real_failed_using_cache"]


class ShopifySyncResult(BaseModel):
    synced_products: int = 0
    synced_sales: int = 0
    errors: list[str] = Field(default_factory=list)
    integration_status: IntegrationStatus = "ok"
