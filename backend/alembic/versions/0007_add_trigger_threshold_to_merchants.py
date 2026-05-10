"""add shopify_trigger_every_n_orders to merchants

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-09

Permite que cada merchant configure cuántas ventas nuevas activan a Vera
automáticamente vía webhook de Shopify, sin tocar el .env global.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "merchants",
        sa.Column(
            "shopify_trigger_every_n_orders",
            sa.Integer(),
            nullable=False,
            server_default="10",
        ),
    )


def downgrade() -> None:
    op.drop_column("merchants", "shopify_trigger_every_n_orders")
