"""extend campaigns table for meta ads

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-09

Capa 6: la tabla `campaigns` original (0002) tenía solo active/paused/finished
y un set mínimo de columnas. Ahora la usamos para registrar el lifecycle real
desde que el merchant aprueba (creating) → Meta responde (created/failed) →
sincronizamos (active/paused/finished). Agregamos columnas para que cada paso
tenga su huella, y dejamos `started_at` nullable porque no toda campaña
arranca al instante de creada.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_NEW_STATUS_VALUES = ("pending", "creating", "created", "failed")


def upgrade() -> None:
    # 1) Sumar los nuevos valores al enum campaign_status. ALTER TYPE ADD VALUE
    #    requiere autocommit en Postgres < 12, en >= 12 puede correr en
    #    transacción si no se usa el valor en la misma migración. Usamos
    #    autocommit_block por compatibilidad.
    with op.get_context().autocommit_block():
        for value in _NEW_STATUS_VALUES:
            op.execute(
                f"ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS '{value}'"
            )

    # 2) Columnas nuevas. Todas nullable o con default para no romper filas
    #    existentes (si las hubiera del demo).
    op.add_column(
        "campaigns",
        sa.Column(
            "kind",
            sa.String(length=32),
            nullable=False,
            server_default="meta_ads",
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column("external_url", sa.Text(), nullable=True),
    )
    op.add_column(
        "campaigns",
        sa.Column(
            "creative_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column("budget_ars", sa.Integer(), nullable=True),
    )
    op.add_column(
        "campaigns",
        sa.Column(
            "payload_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "campaigns",
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.add_column(
        "campaigns",
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "campaigns",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # 3) `started_at` original era NOT NULL con default now(). Para que las
    #    campañas en estado `creating`/`failed`/`created` no requieran un
    #    started_at falso, la hacemos nullable y sacamos el default.
    op.alter_column(
        "campaigns",
        "started_at",
        nullable=True,
        server_default=None,
    )

    # 4) Default del status nuevo: 'creating' refleja mejor la realidad
    #    (la campaña se está creando al insertar la fila).
    op.alter_column(
        "campaigns",
        "status",
        server_default="creating",
    )

    # 5) Index sobre proposal_id (para GET /proposals/{id}/campaign).
    op.create_index(
        "ix_campaigns_proposal_id", "campaigns", ["proposal_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_campaigns_proposal_id", table_name="campaigns")
    op.alter_column(
        "campaigns",
        "status",
        server_default="active",
    )
    op.alter_column(
        "campaigns",
        "started_at",
        nullable=False,
        server_default=sa.func.now(),
    )
    op.drop_column("campaigns", "created_at")
    op.drop_column("campaigns", "last_synced_at")
    op.drop_column("campaigns", "error_message")
    op.drop_column("campaigns", "payload_snapshot")
    op.drop_column("campaigns", "budget_ars")
    op.drop_column("campaigns", "creative_count")
    op.drop_column("campaigns", "external_url")
    op.drop_column("campaigns", "kind")
    # No removemos los valores nuevos del enum — Postgres no soporta DROP
    # VALUE de un enum sin recrear el tipo. En un downgrade real habría que
    # recrear campaign_status entero, pero para este proyecto no vale la pena.
