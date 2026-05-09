import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base declarativa para todos los modelos de Vera."""


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        index=True,
        nullable=False,
    )
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    whatsapp_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="ARS", nullable=False)

    # Credenciales de integraciones por-merchant. Si están vacías, el sync cae a las
    # variables globales del .env (útil para la dev store compartida del demo).
    shopify_shop_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    shopify_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta_ad_account_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    meta_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint(
            "merchant_id", "external_id", name="uq_products_merchant_external"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("merchants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    external_id: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    image_urls: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    attributes: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Sale(Base):
    __tablename__ = "sales"
    __table_args__ = (
        UniqueConstraint(
            "merchant_id",
            "external_order_id",
            "product_id",
            name="uq_sales_merchant_order_product",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("merchants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    external_order_id: Mapped[str] = mapped_column(String(64), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    sold_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )


class ProposalKind(str, enum.Enum):
    campaign = "campaign"
    creative_refresh = "creative_refresh"
    budget_change = "budget_change"


class ProposalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    modified = "modified"


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("merchants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    kind: Mapped[ProposalKind] = mapped_column(
        SQLEnum(ProposalKind, name="proposal_kind", native_enum=True),
        nullable=False,
    )
    status: Mapped[ProposalStatus] = mapped_column(
        SQLEnum(ProposalStatus, name="proposal_status", native_enum=True),
        default=ProposalStatus.pending,
        nullable=False,
    )
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    generated_assets: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class CampaignStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    finished = "finished"


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("merchants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proposals.id", ondelete="CASCADE"),
        nullable=False,
    )
    publisher: Mapped[str] = mapped_column(String(32), nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[CampaignStatus] = mapped_column(
        SQLEnum(CampaignStatus, name="campaign_status", native_enum=True),
        default=CampaignStatus.active,
        nullable=False,
    )
    metrics: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("merchants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    trigger: Mapped[str] = mapped_column(String(32), nullable=False)
    state: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class NotificationStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("merchants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    proposal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("proposals.id", ondelete="SET NULL"),
        nullable=True,
    )
    # kind: 'proposal_ready' | 'proposal_approved_confirmation' |
    #       'proposal_rejected_confirmation' | 'creatives_completed'
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(
        SQLEnum(NotificationStatus, name="notification_status", native_enum=True),
        default=NotificationStatus.pending,
        nullable=False,
    )
    channel: Mapped[str] = mapped_column(String(32), default="whatsapp", nullable=False)
    target_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    message_body: Mapped[str] = mapped_column(Text, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
