"""Seed de desarrollo.

Crea el merchant de demo (idempotente) y dispara una sincronización con
Shopify (real o mock según `USE_SHOPIFY_MOCK`). La idea es que después de
correr esto la DB nunca esté vacía: la app siempre arranca con catálogo y
ventas para mostrar.
"""
import asyncio
import sys
import uuid

from sqlalchemy import select

from app.core.config import settings
from app.db.models import Merchant
from app.db.session import async_session_factory
from app.services.sync import sync_shopify_catalog

DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEMO_BUSINESS_NAME = "Tienda de Ana"


async def load_demo_data() -> None:
    async with async_session_factory() as session:
        existing = await session.execute(
            select(Merchant).where(Merchant.user_id == DEMO_USER_ID)
        )
        merchant = existing.scalar_one_or_none()

        if merchant is None:
            merchant = Merchant(
                user_id=DEMO_USER_ID,
                business_name=DEMO_BUSINESS_NAME,
                whatsapp_phone="+5493510000000",
                currency="ARS",
            )
            session.add(merchant)
            await session.commit()
            await session.refresh(merchant)
            print(f"[seed] merchant '{DEMO_BUSINESS_NAME}' creado.")
        else:
            print(f"[seed] merchant '{merchant.business_name}' ya existía.")

        mode = "MOCK" if settings.USE_SHOPIFY_MOCK else "REAL"
        print(f"[seed] sincronizando catálogo desde Shopify ({mode})...")

        try:
            result = await sync_shopify_catalog(merchant.id, session)
        except Exception as exc:
            print(f"[seed] sync falló: {exc}", file=sys.stderr)
            return

        print(
            f"[seed] {result.synced_products} productos | "
            f"{result.synced_sales} ventas | status={result.integration_status}"
        )
        for err in result.errors:
            print(f"[seed]   ! {err}", file=sys.stderr)


def main() -> None:
    asyncio.run(load_demo_data())


if __name__ == "__main__":
    main()
