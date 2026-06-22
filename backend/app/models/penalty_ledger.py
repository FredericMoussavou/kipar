import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class PenaltyLedger(Base):
    """Releve des mouvements de penalite d'un transporteur.

    Trace uniquement les mouvements de penalite :
    - entry_type="penalty"   : +amount (annulation jugee non justifiee)
    - entry_type="deduction" : -amount (retenue sur un versement de livraison)
    balance_after = solde de penalty_balance apres ce mouvement.
    """
    __tablename__ = "penalty_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    carrier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("bookings.id"), nullable=True, index=True
    )
    amount: Mapped[float] = mapped_column(Float)  # +penalite / -deduction
    entry_type: Mapped[str] = mapped_column(String(20))  # penalty | deduction
    balance_after: Mapped[float] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )