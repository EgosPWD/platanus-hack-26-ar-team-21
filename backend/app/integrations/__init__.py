"""Selector de integraciones — real vs. mock — controlado por toggles del .env.

Ver CLAUDE.md §11 (plan de rollback) y §13 (flujo obligatorio para integraciones).
Cambiar un toggle requiere reiniciar el backend (los imports se resuelven al boot).
"""
from app.core.config import settings

if settings.USE_SHOPIFY_MOCK:
    from app.integrations.shopify_mock import ShopifyClient
else:
    from app.integrations.shopify import ShopifyClient

if settings.USE_META_MOCK:
    from app.integrations.meta_ads_mock import MetaAdsClient
else:
    # Capa 6: cliente con surface completo (campaign/adset/creative/ad).
    # El meta_ads.py viejo (solo ping, Capa 2) queda como dead code para no
    # romper imports históricos pero ya nadie debería usarlo.
    from app.integrations.meta_ads_client import MetaAdsClient

if settings.USE_OPENROUTER_MOCK:
    from app.integrations.openrouter_mock import OpenRouterImageClient
else:
    from app.integrations.openrouter_client import OpenRouterImageClient

if settings.USE_WHATSAPP_MOCK:
    from app.integrations.evolution_mock import EvolutionClient
else:
    from app.integrations.evolution_client import EvolutionClient

__all__ = [
    "ShopifyClient",
    "MetaAdsClient",
    "OpenRouterImageClient",
    "EvolutionClient",
]
