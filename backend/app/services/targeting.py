"""Parser muy simple del audience_hint del agente → targeting de Meta.

El agente compone strings como:
- "Mujeres 25-40 con interés en moda urbana, CABA y GBA"
- "Hombres y mujeres 18 a 35, todo Argentina"
- "Mamás 30-45"

Acá los traducimos al schema que pide la Marketing API:
- geo_locations.countries (ISO 2 letras)
- age_min, age_max
- genders ([1] hombres / [2] mujeres / omitido = todos)

NO hacemos detección de intereses (eso requiere el endpoint /search de Meta
y una capa de NLP que no entra en hackathon). Lo dejamos en geo + edad + género.
"""
from __future__ import annotations

import re
from typing import Any

# Mapeo conservador. Si la moneda es algo no listado o USD, default a Argentina
# (la audiencia objetivo de Vera).
_CURRENCY_TO_COUNTRY: dict[str, str] = {
    "ARS": "AR",
    "BOB": "BO",
    "CLP": "CL",
    "COP": "CO",
    "MXN": "MX",
    "PEN": "PE",
    "BRL": "BR",
    "USD": "AR",
}


_AGE_RANGE_PATTERNS = [
    re.compile(r"(\d{1,2})\s*[-–]\s*(\d{1,2})"),
    re.compile(r"(\d{1,2})\s+a\s+(\d{1,2})"),
    re.compile(r"entre\s+(\d{1,2})\s+y\s+(\d{1,2})"),
]


def _country_for(currency: str) -> str:
    return _CURRENCY_TO_COUNTRY.get((currency or "").upper(), "AR")


def _parse_age_range(text: str, default_min: int, default_max: int) -> tuple[int, int]:
    for pattern in _AGE_RANGE_PATTERNS:
        match = pattern.search(text)
        if match:
            try:
                lo = int(match.group(1))
                hi = int(match.group(2))
            except ValueError:
                continue
            if lo > hi:
                lo, hi = hi, lo
            # Meta acepta 13-65; si el agente devuelve algo fuera, lo clipeamos.
            lo = max(13, min(lo, 65))
            hi = max(13, min(hi, 65))
            return lo, hi
    return default_min, default_max


def _parse_genders(text: str) -> list[int] | None:
    lowered = text.lower()
    has_women = "mujeres" in lowered or "mujer " in lowered or "femenino" in lowered
    has_men = "hombres" in lowered or "hombre " in lowered or "masculino" in lowered
    if has_women and not has_men:
        return [2]
    if has_men and not has_women:
        return [1]
    return None  # ambos


def build_meta_targeting(
    audience_hint: str | None,
    merchant_currency: str = "ARS",
    *,
    default_age_min: int = 18,
    default_age_max: int = 65,
) -> dict[str, Any]:
    """Construye el dict `targeting` que come AdSet.create.

    No falla nunca: si no entiende algo, devuelve defaults seguros.
    """
    text = (audience_hint or "").strip()
    country = _country_for(merchant_currency)
    age_min, age_max = _parse_age_range(text, default_age_min, default_age_max)
    genders = _parse_genders(text)

    targeting: dict[str, Any] = {
        "geo_locations": {"countries": [country]},
        "age_min": age_min,
        "age_max": age_max,
    }
    if genders is not None:
        targeting["genders"] = genders
    return targeting
