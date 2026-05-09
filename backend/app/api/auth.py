from fastapi import APIRouter

from app.core.deps import CurrentMerchant
from app.db.models import Merchant
from app.schemas.merchant import MerchantOut

router = APIRouter(tags=["auth"])


@router.get("/me", response_model=MerchantOut)
async def get_me(merchant: CurrentMerchant) -> Merchant:
    """Devuelve el merchant del usuario autenticado.

    El dependency `CurrentMerchant` se encarga de crearlo on-demand si todavía
    no existe (primer login).
    """
    return merchant
