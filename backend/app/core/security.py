from dataclasses import dataclass

from jose import JWTError, jwt

from app.core.config import settings


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: str | None
    raw_claims: dict


class InvalidTokenError(Exception):
    """JWT inválido, expirado o con audience incorrecto."""


def decode_supabase_jwt(token: str) -> AuthenticatedUser:
    """Valida un JWT emitido por Supabase Auth.

    Supabase firma con HS256 usando el JWT secret del proyecto y emite tokens
    con audience "authenticated".
    """
    if not settings.SUPABASE_JWT_SECRET:
        raise InvalidTokenError("SUPABASE_JWT_SECRET no está configurado")

    try:
        claims = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

    user_id = claims.get("sub")
    if not user_id:
        raise InvalidTokenError("Token sin claim 'sub'")

    return AuthenticatedUser(
        user_id=user_id,
        email=claims.get("email"),
        raw_claims=claims,
    )
