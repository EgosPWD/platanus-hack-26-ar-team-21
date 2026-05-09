"""Seed mínimo para la Capa 1.

La idea es que la app nunca arranque con la DB vacía: si hay un merchant de
demo, lo dejamos listo. Productos, ventas y demás llegan en la Capa 2.
"""
import asyncio
import uuid

from sqlalchemy import select

from app.db.models import Merchant
from app.db.session import async_session_factory

DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEMO_BUSINESS_NAME = "Tienda de Ana"


async def load_demo_data() -> None:
    """Inserta el merchant de demo si todavía no existe."""
    async with async_session_factory() as session:
        existing = await session.execute(
            select(Merchant).where(Merchant.user_id == DEMO_USER_ID)
        )
        if existing.scalar_one_or_none() is not None:
            return

        merchant = Merchant(
            user_id=DEMO_USER_ID,
            business_name=DEMO_BUSINESS_NAME,
            whatsapp_phone="+5493510000000",
            currency="ARS",
        )
        session.add(merchant)
        await session.commit()


def main() -> None:
    asyncio.run(load_demo_data())


if __name__ == "__main__":
    main()
