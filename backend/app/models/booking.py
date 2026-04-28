import uuid
import secrets
from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), index=True)
    package_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("packages.id"), unique=True)
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    receiver_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )

    # Financials
    amount: Mapped[float] = mapped_column(Float)
    insurance_subscribed: Mapped[bool] = mapped_column(Boolean, default=False)
    insurance_amount: Mapped[float] = mapped_column(Float, default=0.0)

    # Paiement
    # payment_rail : stripe / flutterwave / wave / pawapay
    payment_rail: Mapped[str | None] = mapped_column(String(20), nullable=True)
    escrow_ref: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Code de remise
    delivery_code_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    delivery_qr_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    delivery_code_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivery_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivery_confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    # Statut : pending / awaiting_receiver / accepted / refused /
    #          paid / in_transit / delivered / disputed / refunded
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relations
    trip: Mapped["Trip"] = relationship("Trip", back_populates="bookings")
    package: Mapped["Package"] = relationship("Package", back_populates="booking")
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    receiver: Mapped["User | None"] = relationship("User", foreign_keys=[receiver_id])

    @staticmethod
    def generate_delivery_code() -> str:
        """Génère un code de remise à 6 chiffres."""
        return str(secrets.randbelow(900000) + 100000)

    @staticmethod
    def generate_qr_token() -> str:
        return secrets.token_urlsafe(32)
