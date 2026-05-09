import uuid

from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession
from app.db.models import Merchant
from app.schemas.merchant import MerchantOut

router = APIRouter(tags=["auth"])


@router.get("/me", response_model=MerchantOut)
async def get_me(user: CurrentUser, db: DbSession) -> Merchant:
    """Devuelve el merchant del usuario autenticado, creándolo si no existe.

    En la Capa 1 alcanza con tener un registro asociado al user_id de Supabase.
    El nombre del negocio inicial sale del email — Ana lo edita después en la
    pantalla de configuración.
    """
    user_uuid = uuid.UUID(user.user_id)

    result = await db.execute(select(Merchant).where(Merchant.user_id == user_uuid))
    merchant = result.scalar_one_or_none()

    if merchant is None:
        default_name = (user.email or "Mi tienda").split("@")[0]
        merchant = Merchant(
            user_id=user_uuid,
            business_name=default_name,
            currency="ARS",
        )
        db.add(merchant)
        await db.commit()
        await db.refresh(merchant)

    return merchant
