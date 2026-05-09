"""add products sales proposals campaigns and merchant integration fields

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- merchants: integration columns -----------------------------------
    op.add_column(
        "merchants",
        sa.Column("shopify_shop_domain", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "merchants",
        sa.Column("shopify_access_token", sa.Text(), nullable=True),
    )
    op.add_column(
        "merchants",
        sa.Column("meta_ad_account_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "merchants",
        sa.Column("meta_access_token", sa.Text(), nullable=True),
    )

    # --- products ---------------------------------------------------------
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "merchant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("merchants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("external_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("category", sa.String(length=64), nullable=True),
        sa.Column(
            "image_urls",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "attributes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "merchant_id", "external_id", name="uq_products_merchant_external"
        ),
    )
    op.create_index("ix_products_merchant_id", "products", ["merchant_id"])

    # --- sales ------------------------------------------------------------
    op.create_table(
        "sales",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "merchant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("merchants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("external_order_id", sa.String(length=64), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("revenue", sa.Numeric(12, 2), nullable=False),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "merchant_id",
            "external_order_id",
            "product_id",
            name="uq_sales_merchant_order_product",
        ),
    )
    op.create_index("ix_sales_merchant_id", "sales", ["merchant_id"])
    op.create_index("ix_sales_product_id", "sales", ["product_id"])
    op.create_index("ix_sales_sold_at", "sales", ["sold_at"])

    # --- enums + proposals ------------------------------------------------
    proposal_kind = postgresql.ENUM(
        "campaign", "creative_refresh", "budget_change", name="proposal_kind"
    )
    proposal_status = postgresql.ENUM(
        "pending", "approved", "rejected", "modified", name="proposal_status"
    )
    proposal_kind.create(op.get_bind(), checkfirst=True)
    proposal_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "proposals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "merchant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("merchants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "kind",
            postgresql.ENUM(
                "campaign",
                "creative_refresh",
                "budget_change",
                name="proposal_kind",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending",
                "approved",
                "rejected",
                "modified",
                name="proposal_status",
                create_type=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reasoning", sa.Text(), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "generated_assets",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_proposals_merchant_id", "proposals", ["merchant_id"])

    # --- campaigns --------------------------------------------------------
    campaign_status = postgresql.ENUM(
        "active", "paused", "finished", name="campaign_status"
    )
    campaign_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "campaigns",
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
            sa.ForeignKey("proposals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("publisher", sa.String(length=32), nullable=False),
        sa.Column("external_id", sa.String(length=128), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "paused",
                "finished",
                name="campaign_status",
                create_type=False,
            ),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "metrics",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_campaigns_merchant_id", "campaigns", ["merchant_id"])


def downgrade() -> None:
    op.drop_index("ix_campaigns_merchant_id", table_name="campaigns")
    op.drop_table("campaigns")
    op.execute("DROP TYPE IF EXISTS campaign_status")

    op.drop_index("ix_proposals_merchant_id", table_name="proposals")
    op.drop_table("proposals")
    op.execute("DROP TYPE IF EXISTS proposal_status")
    op.execute("DROP TYPE IF EXISTS proposal_kind")

    op.drop_index("ix_sales_sold_at", table_name="sales")
    op.drop_index("ix_sales_product_id", table_name="sales")
    op.drop_index("ix_sales_merchant_id", table_name="sales")
    op.drop_table("sales")

    op.drop_index("ix_products_merchant_id", table_name="products")
    op.drop_table("products")

    op.drop_column("merchants", "meta_access_token")
    op.drop_column("merchants", "meta_ad_account_id")
    op.drop_column("merchants", "shopify_access_token")
    op.drop_column("merchants", "shopify_shop_domain")
