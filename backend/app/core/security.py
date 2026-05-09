import time
from dataclasses import dataclass
from typing import Any

import httpx
from jose import JWTError, jwt

from app.core.config import settings


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: str | None
    raw_claims: dict


class InvalidTokenError(Exception):
    """JWT inválido, expirado o con audience incorrecto."""


# Cache simple de las JWKs públicas de Supabase. Se refresca cada 5 min.
_JWKS_TTL_SECONDS = 300
_jwks_cache: dict[str, Any] = {"keys": None, "fetched_at": 0.0}


def _fetch_jwks() -> list[dict[str, Any]]:
    now = time.time()
    cached = _jwks_cache["keys"]
    if cached is not None and now - _jwks_cache["fetched_at"] < _JWKS_TTL_SECONDS:
        return cached

    if not settings.SUPABASE_URL:
        raise InvalidTokenError("SUPABASE_URL no está configurado")

    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
    try:
        response = httpx.get(url, timeout=5.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise InvalidTokenError(f"No pude leer el JWKS de Supabase: {exc}") from exc

    keys = response.json().get("keys", [])
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys


def _jwk_for_kid(kid: str) -> dict[str, Any]:
    for key in _fetch_jwks():
        if key.get("kid") == kid:
            return key
    # Si no la encontramos, refrescamos por si rotaron las keys recientemente.
    _jwks_cache["fetched_at"] = 0.0
    for key in _fetch_jwks():
        if key.get("kid") == kid:
            return key
    raise InvalidTokenError(f"No hay JWK pública para kid={kid}")


def decode_supabase_jwt(token: str) -> AuthenticatedUser:
    """Valida un JWT emitido por Supabase Auth.

    Soporta tanto HS256 (legacy / shared secret) como ES256/RS256 (JWT Signing
    Keys asimétricas). Para los asimétricos verifica contra las JWKs públicas
    publicadas en `/auth/v1/.well-known/jwks.json`.
    """
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

    alg = header.get("alg")

    try:
        if alg == "HS256":
            if not settings.SUPABASE_JWT_SECRET:
                raise InvalidTokenError("SUPABASE_JWT_SECRET no está configurado")
            claims = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        elif alg in {"ES256", "RS256"}:
            kid = header.get("kid")
            if not kid:
                raise InvalidTokenError("Token asimétrico sin claim 'kid'")
            jwk = _jwk_for_kid(kid)
            claims = jwt.decode(
                token,
                jwk,
                algorithms=[alg],
                audience="authenticated",
            )
        else:
            raise InvalidTokenError(f"Algoritmo no soportado: {alg}")
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
