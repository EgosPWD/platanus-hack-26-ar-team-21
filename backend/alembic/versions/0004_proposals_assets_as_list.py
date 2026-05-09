"""proposals.generated_assets as list

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-09

Capa 4: el campo generated_assets pasa de dict a list (cada elemento es
un GeneratedAsset). JSONB acepta ambos, pero cambiamos el default y migramos
filas existentes que tengan `{}` para que el código no se confunda.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE proposals SET generated_assets = '[]'::jsonb "
        "WHERE generated_assets = '{}'::jsonb OR generated_assets IS NULL"
    )
    op.alter_column(
        "proposals",
        "generated_assets",
        server_default=sa.text("'[]'::jsonb"),
    )


def downgrade() -> None:
    op.execute(
        "UPDATE proposals SET generated_assets = '{}'::jsonb "
        "WHERE generated_assets = '[]'::jsonb OR generated_assets IS NULL"
    )
    op.alter_column(
        "proposals",
        "generated_assets",
        server_default=sa.text("'{}'::jsonb"),
    )
