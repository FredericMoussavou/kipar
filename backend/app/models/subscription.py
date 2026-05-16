import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)

    # Plan
    plan: Mapped[str] = mapped_column(String(20))  # monthly | annual
    status: Mapped[str] = mapped_column(String(20), default="active")
    # active | cancelled | expired | past_due

    # Montant
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(5), default="EUR")

    # Rail de paiement
    payment_rail: Mapped[str] = mapped_column(String(20))  # stripe | flutterwave

    # References externes
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    flw_transaction_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    flw_subscription_id: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Dates
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    renewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relations
    user = relationship("User", foreign_keys=[user_id])