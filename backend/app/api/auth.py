from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.deps import CurrentMerchant, DbSession
from app.db.models import Merchant
from app.schemas.merchant import MerchantOut

router = APIRouter(tags=["auth"])


class MerchantPatch(BaseModel):
    """Campos del merchant que el frontend puede editar desde /settings.

    Mantenemos un set chico — el resto vive en la app y se setea por SQL si
    hace falta.
    """

    business_name: str | None = Field(default=None, max_length=255)
    whatsapp_phone: str | None = Field(default=None, max_length=32)
    currency: str | None = Field(default=None, max_length=8)
    shopify_trigger_every_n_orders: int | None = Field(default=None, ge=1, le=1000)


@router.get("/me", response_model=MerchantOut)
async def get_me(merchant: CurrentMerchant) -> Merchant:
    """Devuelve el merchant del usuario autenticado.

    El dependency `CurrentMerchant` se encarga de crearlo on-demand si todavía
    no existe (primer login).
    """
    return merchant


@router.patch("/me", response_model=MerchantOut)
async def patch_me(
    body: MerchantPatch,
    merchant: CurrentMerchant,
    db: DbSession,
) -> Merchant:
    """Edita campos básicos del merchant: nombre del negocio, teléfono de
    WhatsApp y moneda. Los toggles de integración (Shopify/Meta) se settean
    por separado (capa futura)."""
    if body.business_name is not None:
        merchant.business_name = body.business_name.strip()
    if body.whatsapp_phone is not None:
        merchant.whatsapp_phone = body.whatsapp_phone.strip() or None
    if body.currency is not None:
        merchant.currency = body.currency.strip().upper()
    if body.shopify_trigger_every_n_orders is not None:
        merchant.shopify_trigger_every_n_orders = body.shopify_trigger_every_n_orders
    await db.commit()
    await db.refresh(merchant)
    return merchant
