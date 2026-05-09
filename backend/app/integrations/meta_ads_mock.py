"""Mock de MetaAdsClient — misma interfaz que el cliente real (Capa 6).

Devuelve IDs sintéticos con prefijo `MOCK_` y una URL placeholder al Ads
Manager. No hace ninguna red. Pensado para que el resto del flujo
(MetaPublisher → DB → notificación → UI) sea idéntico al real.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any


class MetaAdsClient:
    def __init__(
        self,
        access_token: str | None = None,
        ad_account_id: str | None = None,
        api_version: str = "v21.0",
    ) -> None:
        self.access_token = access_token or "EAA_mock"
        self.ad_account_id = ad_account_id or "act_mock"
        self.api_version = api_version

    @staticmethod
    def _mock_id(prefix: str) -> str:
        return f"MOCK_{prefix}_{uuid.uuid4().hex[:12]}"

    def _ads_manager_url(self, campaign_id: str) -> str:
        # Link real al Ads Manager — al apretarlo, Meta abre el dashboard
        # con el filtro vacío. Suficiente para la demo sin red.
        return (
            "https://www.facebook.com/adsmanager/manage/campaigns"
            f"?selected_campaign_ids={campaign_id}"
        )

    async def ping(self) -> dict[str, Any]:
        return {
            "connected": True,
            "name": "Mock Ad Account",
            "status": 1,
        }

    async def create_campaign(
        self,
        name: str,
        objective: str = "OUTCOME_TRAFFIC",
        daily_budget_cents: int | None = None,
    ) -> dict[str, Any]:
        cid = self._mock_id("CAMP")
        return {
            "id": cid,
            "name": name,
            "status": "PAUSED",
            "url": self._ads_manager_url(cid),
        }

    async def create_ad_set(
        self,
        campaign_id: str,
        name: str,
        daily_budget_cents: int,
        targeting: dict[str, Any],
        optimization_goal: str = "LINK_CLICKS",
        billing_event: str = "IMPRESSIONS",
    ) -> dict[str, Any]:
        return {
            "id": self._mock_id("ADSET"),
            "name": name,
            "status": "PAUSED",
        }

    async def create_creative_from_image_url(
        self,
        name: str,
        image_url: str,
        message: str,
        link: str,
        call_to_action: str = "SHOP_NOW",
        page_id: str | None = None,
    ) -> dict[str, Any]:
        return {
            "id": self._mock_id("CREA"),
            "name": name,
        }

    async def create_ad(
        self,
        ad_set_id: str,
        creative_id: str,
        name: str,
    ) -> dict[str, Any]:
        return {
            "id": self._mock_id("AD"),
            "name": name,
            "status": "PAUSED",
        }

    async def fetch_campaign_status(self, campaign_id: str) -> dict[str, Any]:
        return {
            "id": campaign_id,
            "name": "Mock campaign",
            "status": "PAUSED",
            "effective_status": "PAUSED",
            "objective": "OUTCOME_TRAFFIC",
            "created_time": datetime.now(timezone.utc).isoformat(),
        }
