"""Cliente real contra Meta Ads (facebook-business SDK).

Capa 2 solo necesita instanciar el cliente y hacer ping. La creación de
campañas vive en la Capa 6 (publishers/meta.py).
"""
import asyncio
import logging
from typing import Any

from facebook_business.adobjects.user import User
from facebook_business.api import FacebookAdsApi

logger = logging.getLogger(__name__)


class MetaAdsClient:
    def __init__(self, access_token: str, ad_account_id: str | None = None) -> None:
        if not access_token:
            raise ValueError(
                "MetaAdsClient requiere access_token "
                "(seteá META_ACCESS_TOKEN o USE_META_MOCK=true)"
            )
        self.access_token = access_token
        self.ad_account_id = ad_account_id
        self._api = FacebookAdsApi.init(access_token=access_token)

    async def ping(self) -> bool:
        def _check() -> bool:
            user = User(fbid="me", api=self._api)
            data: dict[str, Any] = user.api_get(fields=["id"])
            return bool(data.get("id"))

        try:
            return await asyncio.to_thread(_check)
        except Exception as exc:
            logger.warning("Meta Ads ping failed: %s", exc)
            return False
