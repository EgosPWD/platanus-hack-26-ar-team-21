"""Mock de Meta Ads — misma interfaz que el cliente real."""


class MetaAdsClient:
    def __init__(
        self,
        access_token: str | None = None,
        ad_account_id: str | None = None,
    ) -> None:
        self.access_token = access_token or "EAA_mock"
        self.ad_account_id = ad_account_id or "act_mock"

    async def ping(self) -> bool:
        return True
