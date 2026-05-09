"""create merchants table

Revision ID: 0001
Revises:
Create Date: 2026-05-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "merchants",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            unique=True,
        ),
        sa.Column("business_name", sa.String(length=255), nullable=False),
        sa.Column("whatsapp_phone", sa.String(length=32), nullable=True),
        sa.Column(
            "currency",
            sa.String(length=8),
            nullable=False,
            server_default="ARS",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_merchants_user_id",
        "merchants",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_merchants_user_id", table_name="merchants")
    op.drop_table("merchants")
