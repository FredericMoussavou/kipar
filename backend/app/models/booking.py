import uuid
import secrets
from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, Integer
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
    amount_local: Mapped[float | None] = mapped_column(Float, nullable=True)  # montant dans la devise du trip
    weight_unit: Mapped[str] = mapped_column(String(5), default="kg")  # kg | lb - herite du trip
    currency: Mapped[str] = mapped_column(String(5), default="EUR")  # ISO 4217 - herite du trip
    insurance_subscribed: Mapped[bool] = mapped_column(Boolean, default=False)
    insurance_amount: Mapped[float] = mapped_column(Float, default=0.0)

    # Paiement
    # payment_rail : stripe / flutterwave / wave / pawapay
    payment_rail: Mapped[str | None] = mapped_column(String(20), nullable=True)
    escrow_ref: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # --- Nouveau Workflow Collecte (Pickup) ---
    pickup_meeting_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    proposed_pickup_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    proposed_pickup_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    pickup_reschedule_count: Mapped[int] = mapped_column(Integer, default=0)
    pickup_meeting_confirmed_by_sender: Mapped[bool] = mapped_column(Boolean, default=False)
    pickup_meeting_confirmed_by_carrier: Mapped[bool] = mapped_column(Boolean, default=False)
    pickup_code_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pickup_code_plain: Mapped[str | None] = mapped_column(String(10), nullable=True)
    pickup_qr_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pickup_code_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Nouveau Workflow Livraison (Delivery) ---
    delivery_meeting_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    proposed_delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    proposed_delivery_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    delivery_reschedule_count: Mapped[int] = mapped_column(Integer, default=0)
    reminder_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Rappel X heures avant RDV livraison
    delivery_reminder_sent: Mapped[bool] = mapped_column(default=False)
    delivery_alternative_proof_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Code de remise
    delivery_code_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    delivery_code_plain: Mapped[str | None] = mapped_column(String(10), nullable=True)
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

    # Pickup failed
    pickup_failed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    pickup_failed_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pickup_failed_by: Mapped[str | None] = mapped_column(String(10), nullable=True)  # sender | carrier

    # Delivery failed
    delivery_failed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivery_failed_comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    delivery_failed_by: Mapped[str | None] = mapped_column(String(10), nullable=True)  # carrier | receiver

    # Fenetre de justification incidents (pickup_failed / delivery_failed)
    incident_response_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Financier - forfait dossier + force majeure
    booking_fee_collected: Mapped[bool] = mapped_column(Boolean, default=False)
    cancellation_justified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Annulation
    cancellation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

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


    # --- Planification et Sécurité de la Collecte (Pickup) ---
    pickup_meeting_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    proposed_pickup_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    proposed_pickup_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    pickup_reschedule_count: Mapped[int] = mapped_column(default=0)
    pickup_meeting_confirmed_by_sender: Mapped[bool] = mapped_column(Boolean, default=False)
    pickup_meeting_confirmed_by_carrier: Mapped[bool] = mapped_column(Boolean, default=False)
    pickup_code_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pickup_code_plain: Mapped[str | None] = mapped_column(String(10), nullable=True)
    pickup_qr_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pickup_code_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


    # --- Planification et Sécurité de la Livraison (Delivery) ---
    delivery_meeting_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    proposed_delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    proposed_delivery_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    delivery_reschedule_count: Mapped[int] = mapped_column(default=0)
    delivery_alternative_proof_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

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
