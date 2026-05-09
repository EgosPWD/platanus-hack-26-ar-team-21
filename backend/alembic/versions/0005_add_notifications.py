"""add notifications table

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-09

Capa 5: registramos en DB cada intento de notificación (WhatsApp por ahora,
email/otros canales en el futuro) para tener bitácora aunque Evolution falle.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    notification_status = postgresql.ENUM(
        "pending", "sent", "failed", name="notification_status"
    )
    notification_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "merchant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("merchants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "proposal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("proposals.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending",
                "sent",
                "failed",
                name="notification_status",
                create_type=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "channel", sa.String(length=32), nullable=False, server_default="whatsapp"
        ),
        sa.Column("target_phone", sa.String(length=32), nullable=True),
        sa.Column("message_body", sa.Text(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_notifications_merchant_id", "notifications", ["merchant_id"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_merchant_id", table_name="notifications")
    op.drop_table("notifications")
    op.execute("DROP TYPE IF EXISTS notification_status")
