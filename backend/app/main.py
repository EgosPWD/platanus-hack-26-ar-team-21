import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth as auth_router
from app.api import products as products_router
from app.api import proposals as proposals_router
from app.api import sales as sales_router
from app.core.config import settings

logger = logging.getLogger("vera")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Health-check de las integraciones al boot.

    No bloqueamos el arranque si fallan: solo logueamos. La regla del rollback
    en 30 minutos (CLAUDE.md §11) la resolvemos cambiando los toggles.
    """
    from app.integrations import MetaAdsClient, ShopifyClient  # lazy import

    mode_shopify = "MOCK" if settings.USE_SHOPIFY_MOCK else "REAL"
    mode_meta = "MOCK" if settings.USE_META_MOCK else "REAL"
    logger.info("Integrations | shopify=%s meta=%s", mode_shopify, mode_meta)

    try:
        if settings.USE_META_MOCK:
            meta_client = MetaAdsClient()
        else:
            meta_client = MetaAdsClient(
                access_token=settings.META_ACCESS_TOKEN,
                ad_account_id=settings.META_AD_ACCOUNT_ID,
            )
        ok = await meta_client.ping()
        logger.info("Meta ping: %s", "ok" if ok else "FAILED")
    except Exception:
        logger.exception("Meta client could not be instantiated")

    if settings.USE_SHOPIFY_MOCK:
        logger.info("Shopify ping: ok (mock)")
    elif settings.SHOPIFY_SHOP_DOMAIN and settings.SHOPIFY_ADMIN_TOKEN:
        try:
            async with ShopifyClient(
                shop_domain=settings.SHOPIFY_SHOP_DOMAIN,
                admin_token=settings.SHOPIFY_ADMIN_TOKEN,
            ) as shopify:
                ok = await shopify.ping()
                logger.info("Shopify ping: %s", "ok" if ok else "FAILED")
        except Exception:
            logger.exception("Shopify client could not be instantiated")

    yield


app = FastAPI(
    title="Vera API",
    description="Backend del agente de marketing autónomo Vera.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "shopify_mock": settings.USE_SHOPIFY_MOCK,
        "meta_mock": settings.USE_META_MOCK,
        "replicate_mock": settings.USE_REPLICATE_MOCK,
    }


app.include_router(auth_router.router)
app.include_router(products_router.router)
app.include_router(sales_router.router)
app.include_router(proposals_router.router)
app.include_router(proposals_router.runs_router)
