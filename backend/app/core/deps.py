import uuid
from typing import Annotated, AsyncIterator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthenticatedUser, InvalidTokenError, decode_supabase_jwt
from app.db.models import Merchant
from app.db.session import async_session_factory

bearer_scheme = HTTPBearer(auto_error=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        yield session


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> AuthenticatedUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta el token de autenticación",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return decode_supabase_jwt(credentials.credentials)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_merchant(
    user: CurrentUser,
    db: DbSession,
) -> Merchant:
    """Resuelve (y crea si hace falta) el merchant del usuario logueado.

    Materializar acá evita races con el frontend cuando el dashboard pega a /me
    y /sales/summary en paralelo. El nombre por defecto se deriva del email
    (Ana puede editarlo después en /settings).
    """
    user_uuid = uuid.UUID(user.user_id)
    merchant = (
        await db.execute(select(Merchant).where(Merchant.user_id == user_uuid))
    ).scalar_one_or_none()
    if merchant is not None:
        return merchant

    default_name = (user.email or "Mi tienda").split("@")[0]
    merchant = Merchant(
        user_id=user_uuid,
        business_name=default_name,
        currency="ARS",
    )
    db.add(merchant)
    try:
        await db.commit()
        await db.refresh(merchant)
        return merchant
    except IntegrityError:
        # Otro request concurrente ya lo creó: lo leemos y devolvemos.
        await db.rollback()
        merchant = (
            await db.execute(select(Merchant).where(Merchant.user_id == user_uuid))
        ).scalar_one()
        return merchant


CurrentMerchant = Annotated[Merchant, Depends(get_current_merchant)]
