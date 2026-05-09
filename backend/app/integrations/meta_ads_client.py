"""Cliente real contra Meta Marketing API (facebook-business SDK).

Toda llamada al SDK es síncrona, así que la envolvemos con `asyncio.to_thread`
para no bloquear el event loop. Errores del SDK se mapean a `MetaAdsError`
con mensaje en español pensando en el caller (que termina poniendo eso en
una notification al merchant cuando es accionable).

Reglas duras (CLAUDE.md §11 / spec Capa 6):
- TODA campaign/adset/ad se crea con status="PAUSED" — sin excepción.
- El ad account está en sandbox (act_1250176163094942), las campañas son
  reales pero no se publican hasta que un humano las active en Meta.

API surface mínima esperada por MetaPublisher:
- ping()
- create_campaign(name, objective, daily_budget_cents)
- create_ad_set(campaign_id, name, daily_budget_cents, targeting, ...)
- create_creative_from_image_url(name, image_url, message, link, cta)
- create_ad(ad_set_id, creative_id, name)
- fetch_campaign_status(campaign_id)
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.adcreative import AdCreative
from facebook_business.adobjects.adimage import AdImage
from facebook_business.adobjects.campaign import Campaign as FbCampaign
from facebook_business.api import FacebookAdsApi
from facebook_business.exceptions import FacebookRequestError

logger = logging.getLogger("vera.meta_ads")


class MetaAdsError(Exception):
    """Falla mapeada desde Meta. `code` es el código del SDK (190, 100, 17, …)
    y `user_message` es el texto pensado para mostrarle al merchant."""

    def __init__(self, message: str, *, code: int | None = None, raw: Any = None) -> None:
        super().__init__(message)
        self.code = code
        self.raw = raw
        self.user_message = message


def _map_fb_error(exc: FacebookRequestError) -> MetaAdsError:
    code = exc.api_error_code()
    subcode = exc.api_error_subcode()
    raw_msg = exc.api_error_message() or str(exc)
    lowered = raw_msg.lower()

    # Sacar todo lo que Meta nos da en el body — `error_user_msg` y
    # `error_user_title` suelen tener el motivo real cuando `message` es
    # genérico tipo "Invalid parameter".
    body: Any = None
    error_user_msg: str | None = None
    error_user_title: str | None = None
    try:
        body = exc.body()
    except Exception:
        body = None
    if isinstance(body, dict):
        err = body.get("error") or {}
        error_user_msg = err.get("error_user_msg")
        error_user_title = err.get("error_user_title")

    request_ctx: Any = None
    try:
        request_ctx = exc.request_context()
    except Exception:
        request_ctx = None

    # Log completo para debugging — el usuario rara vez puede mandar
    # el body crudo a soporte, así que lo persistimos en el log estructurado.
    logger.warning(
        "meta error code=%s subcode=%s msg=%r user_msg=%r user_title=%r body=%s req=%s",
        code,
        subcode,
        raw_msg,
        error_user_msg,
        error_user_title,
        body,
        request_ctx,
    )

    # Composer del mensaje user-friendly
    detail = error_user_msg or error_user_title or raw_msg

    if code == 190:
        msg = "Token de Meta inválido o expirado. Generá un nuevo System User Token."
    elif code == 100 and (
        "does not exist" in lowered
        or "missing permissions" in lowered
        or "cannot be loaded" in lowered
    ):
        msg = (
            "El token de Meta no tiene acceso a este ad account. "
            "Verificá que el System User esté asignado al ad account en el "
            "Business Manager con permiso de 'Manage Ad Account', y que el "
            "token incluya ads_management."
        )
    elif code == 100:
        # "Invalid parameter" puro y duro. Damos lo que tengamos —
        # detail puede ser el mensaje de Meta o un user_msg específico.
        suffix = f" (subcode {subcode})" if subcode else ""
        msg = f"Meta rechazó parámetros de la campaña{suffix}: {detail}"
    elif code == 17:
        msg = "Meta nos está rate-limiteando. Esperá 1 minuto y reintentamos."
    elif code in (200, 210):
        msg = (
            "Faltan permisos en el token de Meta (revisá ads_management y que el "
            "token sea de System User)."
        )
    elif code == 2635:
        msg = "La cuenta de ads de Meta está inactiva. Revisala en Business Manager."
    else:
        msg = f"Meta rechazó la operación (code={code}/{subcode}): {detail}"

    return MetaAdsError(
        msg,
        code=code,
        raw={
            "code": code,
            "subcode": subcode,
            "msg": raw_msg,
            "user_msg": error_user_msg,
            "user_title": error_user_title,
            "body": body,
            "request": request_ctx,
        },
    )


class MetaAdsClient:
    def __init__(
        self,
        access_token: str | None = None,
        ad_account_id: str | None = None,
        api_version: str = "v21.0",
    ) -> None:
        if not access_token:
            raise ValueError(
                "MetaAdsClient requiere access_token "
                "(seteá META_ACCESS_TOKEN o USE_META_MOCK=true)"
            )
        if not ad_account_id:
            raise ValueError(
                "MetaAdsClient requiere ad_account_id "
                "(seteá META_AD_ACCOUNT_ID, ej: 'act_1234567890')"
            )
        self.access_token = access_token
        self.ad_account_id = ad_account_id
        self.api_version = api_version
        # FacebookAdsApi.init es global pero también devuelve la instancia. La
        # guardamos por si en el futuro queremos múltiples cuentas en paralelo
        # (cada cliente con su token).
        self._api = FacebookAdsApi.init(
            access_token=access_token, api_version=api_version
        )

    # ------------------------------------------------------------------ ping

    async def ping(self) -> dict[str, Any]:
        def _check() -> dict[str, Any]:
            account = AdAccount(self.ad_account_id, api=self._api)
            data = account.api_get(fields=["name", "account_status"])
            return {
                "connected": True,
                "name": data.get("name"),
                "status": data.get("account_status"),
            }

        try:
            return await asyncio.to_thread(_check)
        except FacebookRequestError as exc:
            err = _map_fb_error(exc)
            logger.warning("meta ping failed: %s", err.user_message)
            return {"connected": False, "error": err.user_message}
        except Exception as exc:
            logger.warning("meta ping failed (non-fb): %s", exc)
            return {"connected": False, "error": str(exc)}

    # ------------------------------------------------------------- campaign

    def _ads_manager_url(self, campaign_id: str) -> str:
        # ad_account_id viene como 'act_123456'; el deep link de Ads Manager
        # usa solo el número.
        numeric = self.ad_account_id.replace("act_", "")
        return (
            f"https://www.facebook.com/adsmanager/manage/campaigns"
            f"?act={numeric}&selected_campaign_ids={campaign_id}"
        )

    async def create_campaign(
        self,
        name: str,
        objective: str = "OUTCOME_TRAFFIC",
        daily_budget_cents: int | None = None,
    ) -> dict[str, Any]:
        def _create() -> dict[str, Any]:
            account = AdAccount(self.ad_account_id, api=self._api)
            params: dict[str, Any] = {
                "name": name,
                "objective": objective,
                "status": "PAUSED",  # HARD-CODED — nunca cambiar.
                "special_ad_categories": [],
                # Meta v25+ exige declarar explícitamente si los ad sets
                # comparten budget. Como manejamos budget a nivel ad_set
                # (más flexible para hackathon), va False.
                "is_adset_budget_sharing_enabled": False,
            }
            # Para Capa 6 manejamos budget a nivel ad_set (más flexible),
            # pero dejamos el hook por si más adelante queremos campaign-level.
            if daily_budget_cents:
                params["daily_budget"] = daily_budget_cents
                # Si seteamos budget a nivel campaign, sí lo compartimos.
                params["is_adset_budget_sharing_enabled"] = True
            campaign = account.create_campaign(params=params)
            cid = campaign["id"]
            return {
                "id": cid,
                "name": name,
                "status": "PAUSED",
                "url": self._ads_manager_url(cid),
            }

        try:
            return await asyncio.to_thread(_create)
        except FacebookRequestError as exc:
            raise _map_fb_error(exc) from exc

    # -------------------------------------------------------------- ad_set

    async def create_ad_set(
        self,
        campaign_id: str,
        name: str,
        daily_budget_cents: int,
        targeting: dict[str, Any],
        optimization_goal: str = "LINK_CLICKS",
        billing_event: str = "IMPRESSIONS",
    ) -> dict[str, Any]:
        def _create() -> dict[str, Any]:
            account = AdAccount(self.ad_account_id, api=self._api)
            now = datetime.now(timezone.utc)
            params: dict[str, Any] = {
                "name": name,
                "campaign_id": campaign_id,
                "daily_budget": daily_budget_cents,
                "billing_event": billing_event,
                "optimization_goal": optimization_goal,
                "targeting": targeting,
                "status": "PAUSED",
                "start_time": (now + timedelta(minutes=5)).isoformat(),
                "end_time": (now + timedelta(days=30)).isoformat(),
            }
            adset = account.create_ad_set(params=params)
            return {
                "id": adset["id"],
                "name": name,
                "status": "PAUSED",
            }

        try:
            return await asyncio.to_thread(_create)
        except FacebookRequestError as exc:
            raise _map_fb_error(exc) from exc

    # ------------------------------------------------------------ creative

    async def create_creative_from_image_url(
        self,
        name: str,
        image_url: str,
        message: str,
        link: str,
        call_to_action: str = "SHOP_NOW",
        page_id: str | None = None,
    ) -> dict[str, Any]:
        """Crea un AdCreative.

        Estrategia:
        1. Probar con `image_url` directo (Meta acepta URLs públicas).
        2. Si falla, descargar la imagen, subirla a AdImage, usar `image_hash`.

        `page_id` no es necesario en sandbox para algunos objectives, pero la
        Marketing API a veces lo exige. Se acepta como opcional para
        que el publisher lo inyecte si lo tiene configurado.
        """

        def _link_data(image_field: dict[str, Any]) -> dict[str, Any]:
            data = {
                **image_field,
                "link": link,
                "message": message,
                "name": name[:50],
                "call_to_action": {
                    "type": call_to_action,
                    "value": {"link": link},
                },
            }
            return data

        def _build_object_story_spec(image_field: dict[str, Any]) -> dict[str, Any]:
            spec: dict[str, Any] = {"link_data": _link_data(image_field)}
            if page_id:
                spec["page_id"] = page_id
            return spec

        def _create_with_url() -> dict[str, Any]:
            account = AdAccount(self.ad_account_id, api=self._api)
            spec = _build_object_story_spec({"image_url": image_url})
            params: dict[str, Any] = {
                "name": name,
                "object_story_spec": spec,
            }
            creative = account.create_ad_creative(params=params)
            return {"id": creative["id"], "name": name}

        try:
            return await asyncio.to_thread(_create_with_url)
        except FacebookRequestError as exc:
            # Si Meta no aceptó la URL pública, fallback: subir la imagen.
            logger.info(
                "create_creative_from_image_url URL fallback (code=%s): %s",
                exc.api_error_code(),
                exc.api_error_message(),
            )

        # Fallback: descargar + AdImage upload + usar image_hash.
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(image_url)
                response.raise_for_status()
                content = response.content
        except Exception as exc:
            raise MetaAdsError(
                f"No pude descargar la creatividad para subirla a Meta: {exc}",
            ) from exc

        def _upload_and_create() -> dict[str, Any]:
            account = AdAccount(self.ad_account_id, api=self._api)
            tmp_name = f"/tmp/vera-meta-{uuid.uuid4().hex}.png"
            with open(tmp_name, "wb") as f:
                f.write(content)
            ad_image = AdImage(parent_id=self.ad_account_id, api=self._api)
            ad_image[AdImage.Field.filename] = tmp_name
            ad_image.remote_create()
            image_hash = ad_image[AdImage.Field.hash]

            spec = _build_object_story_spec({"image_hash": image_hash})
            params: dict[str, Any] = {
                "name": name,
                "object_story_spec": spec,
            }
            creative = account.create_ad_creative(params=params)
            return {"id": creative["id"], "name": name, "image_hash": image_hash}

        try:
            return await asyncio.to_thread(_upload_and_create)
        except FacebookRequestError as exc:
            raise _map_fb_error(exc) from exc

    # --------------------------------------------------------------------- ad

    async def create_ad(
        self,
        ad_set_id: str,
        creative_id: str,
        name: str,
    ) -> dict[str, Any]:
        def _create() -> dict[str, Any]:
            account = AdAccount(self.ad_account_id, api=self._api)
            params: dict[str, Any] = {
                "name": name,
                "adset_id": ad_set_id,
                "creative": {"creative_id": creative_id},
                "status": "PAUSED",
            }
            ad = account.create_ad(params=params)
            return {"id": ad["id"], "name": name, "status": "PAUSED"}

        try:
            return await asyncio.to_thread(_create)
        except FacebookRequestError as exc:
            raise _map_fb_error(exc) from exc

    # ------------------------------------------------------- fetch_campaign

    async def fetch_campaign_status(self, campaign_id: str) -> dict[str, Any]:
        def _fetch() -> dict[str, Any]:
            campaign = FbCampaign(campaign_id, api=self._api)
            data = campaign.api_get(
                fields=[
                    "id",
                    "name",
                    "status",
                    "effective_status",
                    "objective",
                    "created_time",
                ]
            )
            return {
                "id": data.get("id"),
                "name": data.get("name"),
                "status": data.get("status"),
                "effective_status": data.get("effective_status"),
                "objective": data.get("objective"),
                "created_time": data.get("created_time"),
            }

        try:
            return await asyncio.to_thread(_fetch)
        except FacebookRequestError as exc:
            raise _map_fb_error(exc) from exc
