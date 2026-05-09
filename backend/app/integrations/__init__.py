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
    from app.integrations.meta_ads import MetaAdsClient

__all__ = ["ShopifyClient", "MetaAdsClient"]
