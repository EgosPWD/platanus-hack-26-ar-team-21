"""Construye los prompts que se le mandan a FLUX.2 para generar las creatividades.

El prompt es la pieza más importante de la Capa 4 — más que la mecánica del código.
Si los prompts son mediocres, las imágenes son mediocres.

Estructura común:
    [shot type] of [product] [worn by], [styling], [lighting], [background],
    [composition], [quality modifiers]

Reglas duras:
- NUNCA mencionar marcas, celebridades, IPs, o "in the style of [artist]".
- Solo descriptores genéricos de fotografía.
- Adaptar dinámicamente a categoría / color del producto.
- Tomar pistas del creative_brief solo cuando encajen con la variante.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.db.models import Product

VARIANT_NAMES: list[str] = [
    "studio_clean",
    "lifestyle_natural",
    "flat_lay",
    "detail_macro",
    "lifestyle_urban",
]
VARIANT_COUNT = len(VARIANT_NAMES)


@dataclass(frozen=True)
class _Garment:
    """Cómo nombrar la prenda en inglés y cómo describir el "worn by"."""
    noun: str
    worn_by: str


_GARMENT_FALLBACK = _Garment(noun="garment", worn_by="model wearing the garment")


def _classify_garment(category: str | None, name: str | None) -> _Garment:
    text = f"{(category or '').lower()} {(name or '').lower()}"
    if any(k in text for k in ("vestido", "dress")):
        return _Garment("dress", "model wearing the dress")
    if any(k in text for k in ("remera", "camiseta", "t-shirt", "tshirt", "shirt")):
        return _Garment("t-shirt", "model wearing the t-shirt")
    if any(k in text for k in ("jean", "pantalon", "trouser", "pants")):
        return _Garment("jeans", "model wearing the jeans, shown waist-down")
    if any(k in text for k in ("falda", "pollera", "skirt")):
        return _Garment("skirt", "model wearing the skirt")
    if any(k in text for k in ("campera", "saco", "blazer", "jacket")):
        return _Garment("jacket", "model wearing the jacket")
    return _GARMENT_FALLBACK


def _color_phrase(attributes: dict | None) -> str:
    """Devuelve "red ", "navy blue ", o "" para incluir en el prompt."""
    if not attributes:
        return ""
    color_es = (
        attributes.get("color")
        or attributes.get("colour")
        or attributes.get("Color")
        or ""
    )
    color_es = str(color_es).strip().lower()
    if not color_es:
        return ""
    color_map = {
        "rojo": "red",
        "roja": "red",
        "azul": "blue",
        "negro": "black",
        "negra": "black",
        "blanco": "white",
        "blanca": "white",
        "verde": "green",
        "amarillo": "yellow",
        "amarilla": "yellow",
        "rosa": "pink",
        "rosado": "pink",
        "violeta": "purple",
        "naranja": "orange",
        "marron": "brown",
        "marrón": "brown",
        "gris": "gray",
        "beige": "beige",
        "celeste": "light blue",
    }
    en = color_map.get(color_es, color_es)
    return f"{en} "


def _hour_hint(creative_brief: str) -> str:
    """Si el brief sugiere hora dorada / atardecer, devolvemos `golden hour`."""
    brief = (creative_brief or "").lower()
    if any(k in brief for k in ("dorad", "golden hour", "atardecer", "magic hour", "hora mágica")):
        return "golden hour"
    if any(k in brief for k in ("amanecer", "sunrise", "matinal")):
        return "morning light"
    return "soft natural daylight"


def build_flux_prompt(product: Product, creative_brief: str, variant_index: int) -> str:
    """Devuelve el prompt en inglés para una de las 5 variantes (0..4).

    El producto se describe en inglés y se le agrega color si está disponible.
    El creative_brief solo se usa para inferir hora/setting, no se concatena
    crudo (el brief de Vera tiene texto en español que no le suma a FLUX).
    """
    if not 0 <= variant_index < VARIANT_COUNT:
        raise ValueError(f"variant_index {variant_index} fuera de [0, {VARIANT_COUNT - 1}]")

    garment = _classify_garment(product.category, product.name)
    color = _color_phrase(product.attributes)
    hour = _hour_hint(creative_brief)

    if variant_index == 0:
        # studio_clean — la "foto de catálogo" canónica. Va en el feed primero.
        return (
            f"professional studio product photography of a {color}{garment.noun}, "
            "clean white seamless background, soft diffused lighting from above, "
            "centered composition, high-end fashion catalog style, sharp focus, "
            "8k, photorealistic, magazine quality"
        )

    if variant_index == 1:
        # lifestyle_natural — modelo en contexto natural, vibe editorial.
        return (
            f"lifestyle photography of {garment.worn_by}, {color}{garment.noun}, "
            f"{hour}, warm tones, shallow depth of field, candid moment, "
            "editorial fashion photography, photorealistic, high resolution"
        )

    if variant_index == 2:
        # flat_lay — top-down, ideal para Instagram con texto encima.
        return (
            f"overhead flat lay photography of a {color}{garment.noun}, "
            "styled with complementary minimalist accessories, neutral oatmeal "
            "background, soft natural light from window, minimalist composition, "
            "top-down view, fashion editorial, photorealistic"
        )

    if variant_index == 3:
        # detail_macro — textura y craftsmanship, transmite "calidad".
        color_tone = color.strip() or "natural"
        return (
            f"macro detail photography of {color}{garment.noun} fabric showing "
            f"texture and craftsmanship, {color_tone} tones, dramatic side lighting, "
            "shallow focus on weave, premium quality feel, photorealistic, sharp detail"
        )

    # variant_index == 4 — lifestyle_urban
    return (
        f"lifestyle photography of {garment.worn_by}, {color}{garment.noun}, "
        "urban Latin American street setting, golden hour light, model walking, "
        "candid street style, editorial fashion magazine, blurred city background, "
        "photorealistic, cinematic"
    )
