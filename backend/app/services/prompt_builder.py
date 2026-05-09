"""Construye los prompts que se le mandan a FLUX.2 para generar las creatividades.

El prompt es la pieza más importante de la Capa 4 — más que la mecánica del código.
Si los prompts son mediocres, las imágenes son mediocres.

Estructura común:
    [shot type] of [product phrase] [worn by], [styling], [lighting], [background],
    [composition], [quality modifiers]

Reglas duras:
- NUNCA mencionar marcas, celebridades, IPs, o "in the style of [artist]".
- Solo descriptores genéricos de fotografía.
- Adaptar dinámicamente: color (de attributes O del nombre), tela, prenda.
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


# --- Diccionarios ES→EN para extraer features del nombre del producto. ----
# Orden por longitud descendente al matchear: "tiro alto" antes que "tiro".

_COLOR_ES_EN: dict[str, str] = {
    "rojo": "red", "roja": "red",
    "azul": "blue",
    "negro": "black", "negra": "black",
    "blanco": "white", "blanca": "white",
    "verde": "green",
    "amarillo": "yellow", "amarilla": "yellow",
    "rosa": "pink", "rosado": "pink", "rosada": "pink",
    "violeta": "purple", "morado": "purple", "lila": "lilac",
    "naranja": "orange",
    "marron": "brown", "marrón": "brown",
    "gris": "gray",
    "beige": "beige",
    "celeste": "light blue",
    "crema": "cream",
    "dorado": "gold", "dorada": "gold",
    "plateado": "silver", "plateada": "silver",
}

_FABRIC_ES_EN: dict[str, str] = {
    "gasa": "chiffon",
    "seda": "silk",
    "algodon": "cotton", "algodón": "cotton",
    "lino": "linen",
    "encaje": "lace",
    "saten": "satin", "satén": "satin",
    "denim": "denim",
    "cuero": "leather",
    "lana": "wool",
    "tul": "tulle",
    "raso": "satin",
}

_PATTERN_ES_EN: dict[str, str] = {
    "estampado": "patterned", "estampada": "patterned",
    "flores": "floral", "floral": "floral",
    "rayas": "striped", "rayado": "striped", "rayada": "striped",
    "lunares": "polka dot",
    "cuadros": "checked", "cuadrille": "checked",
    "liso": "solid color", "lisa": "solid color",
}


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


def _scan_dict(text: str, mapping: dict[str, str]) -> str | None:
    """Devuelve la primera coincidencia EN del mapping en `text` (ya lowercased).
    Recorre keys de mayor a menor longitud para que "rosado" gane sobre "rosa"."""
    for key in sorted(mapping.keys(), key=len, reverse=True):
        if key in text:
            return mapping[key]
    return None


def _extract_features(product: Product) -> dict[str, str]:
    """Pulla color + tela + patrón de attributes y, como fallback, del nombre.

    Devuelve un dict con strings vacíos si no encuentra. Esto se concatena en
    el prompt: "{color} {pattern} {fabric} {garment}", filtrando vacíos.
    """
    attrs = product.attributes or {}
    name_lower = (product.name or "").lower()

    # Color: primero attributes, después nombre.
    color_es = (
        attrs.get("color") or attrs.get("colour") or attrs.get("Color") or ""
    )
    color_es = str(color_es).strip().lower()
    color_en = _COLOR_ES_EN.get(color_es) if color_es else None
    if not color_en:
        color_en = _scan_dict(name_lower, _COLOR_ES_EN)

    # Tela
    fabric_attr = (
        attrs.get("material") or attrs.get("fabric") or attrs.get("tela") or ""
    )
    fabric_attr = str(fabric_attr).strip().lower()
    fabric_en = _FABRIC_ES_EN.get(fabric_attr) if fabric_attr else None
    if not fabric_en:
        fabric_en = _scan_dict(name_lower, _FABRIC_ES_EN)

    # Patrón
    pattern_en = _scan_dict(name_lower, _PATTERN_ES_EN)

    return {
        "color": color_en or "",
        "fabric": fabric_en or "",
        "pattern": pattern_en or "",
    }


def _build_product_phrase(product: Product, garment_noun: str) -> str:
    """Frase descriptiva del producto en inglés.

    Ej: "Vestido rojo de gasa" → "red chiffon dress"
    Ej: "Remera estampada flores" → "floral patterned t-shirt"
    Ej: "Jean tiro alto mom fit" → "blue denim jeans"
    Si no hay color/tela/patrón, queda "dress" / "t-shirt" / "jeans".
    """
    feats = _extract_features(product)
    parts = [feats["color"], feats["pattern"], feats["fabric"], garment_noun]
    return " ".join(p for p in parts if p)


def _hour_hint(creative_brief: str) -> str:
    """Si el brief sugiere hora dorada / atardecer, devolvemos `golden hour`."""
    brief = (creative_brief or "").lower()
    if any(k in brief for k in ("dorad", "golden hour", "atardecer", "magic hour", "hora mágica")):
        return "golden hour"
    if any(k in brief for k in ("amanecer", "sunrise", "matinal")):
        return "morning light"
    return "soft natural daylight"


_PRESERVE = (
    "Preserve this exact garment from the reference image — keep the original "
    "color, fabric, pattern, neckline, length and silhouette identical. Only "
    "the styling, lighting, background and pose may change."
)


def build_flux_prompt(
    product: Product,
    creative_brief: str,
    variant_index: int,
    has_reference: bool = False,
) -> str:
    """Devuelve el prompt en inglés para una de las 5 variantes (0..4).

    Si `has_reference=True`, el prompt asume que se le pasa una imagen del
    producto al modelo (image-to-image) y le pide explícitamente preservar
    la prenda. Si no, se usa la descripción textual (text-to-image puro).
    """
    if not 0 <= variant_index < VARIANT_COUNT:
        raise ValueError(f"variant_index {variant_index} fuera de [0, {VARIANT_COUNT - 1}]")

    garment = _classify_garment(product.category, product.name)
    product_phrase = _build_product_phrase(product, garment.noun)
    hour = _hour_hint(creative_brief)
    feats = _extract_features(product)
    color_tone = feats["color"] or "warm"

    # En modo img2img el subject es "this exact garment from the reference image".
    # En text-only el subject es la descripción textual ("red chiffon dress").
    subject = "this exact garment from the reference image" if has_reference else f"a {product_phrase}"
    worn_by = (
        "model wearing this exact garment from the reference image"
        if has_reference
        else garment.worn_by
    )
    suffix = f" {_PRESERVE}" if has_reference else ""

    if variant_index == 0:
        # studio_clean — la "foto de catálogo" canónica. Va en el feed primero.
        return (
            f"professional studio product photography of {subject}, "
            "clean white seamless background, soft diffused lighting from above, "
            "centered composition, high-end fashion catalog style, sharp focus, "
            f"8k, photorealistic, magazine quality.{suffix}"
        )

    if variant_index == 1:
        # lifestyle_natural — modelo en contexto natural, vibe editorial.
        return (
            f"lifestyle photography of {worn_by}, "
            f"{hour}, warm tones, shallow depth of field, candid moment, "
            f"editorial fashion photography, photorealistic, high resolution.{suffix}"
        )

    if variant_index == 2:
        # flat_lay — top-down, ideal para Instagram con texto encima.
        return (
            f"overhead flat lay photography of {subject}, "
            "styled with complementary minimalist accessories, neutral oatmeal "
            "background, soft natural light from window, minimalist composition, "
            f"top-down view, fashion editorial, photorealistic.{suffix}"
        )

    if variant_index == 3:
        # detail_macro — textura y craftsmanship, transmite "calidad".
        subject_detail = (
            "the fabric of this exact garment from the reference image"
            if has_reference
            else f"{product_phrase} fabric"
        )
        return (
            f"macro detail photography of {subject_detail} showing "
            f"texture and craftsmanship, {color_tone} tones, dramatic side lighting, "
            f"shallow focus on weave, premium quality feel, photorealistic, sharp detail.{suffix}"
        )

    # variant_index == 4 — lifestyle_urban
    return (
        f"lifestyle photography of {worn_by}, "
        "urban Latin American street setting, golden hour light, model walking, "
        "candid street style, editorial fashion magazine, blurred city background, "
        f"photorealistic, cinematic.{suffix}"
    )
