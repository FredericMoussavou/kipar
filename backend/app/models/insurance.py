import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Insurance(Base):
    """
    Assurance colis souscrite par l'expéditeur.
    Prime = taux * valeur_déclarée.
    Couverture max = valeur_déclarée.
    """
    __tablename__ = "insurances"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id"), unique=True, index=True
    )
    package_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("packages.id"))
    subscriber_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    # Calcul prime
    declared_value: Mapped[float] = mapped_column(Float)
    rate: Mapped[float] = mapped_column(Float)          # ex: 0.03
    premium_amount: Mapped[float] = mapped_column(Float) # prime payée
    coverage_amount: Mapped[float] = mapped_column(Float) # couverture max

    # Statut : active / claimed / paid_out / cancelled
    status: Mapped[str] = mapped_column(String(20), default="active")

    subscribed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    payout_amount: Mapped[float] = mapped_column(Float, default=0.0)
    payout_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
