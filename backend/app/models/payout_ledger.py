import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class PayoutLedger(Base):
    """Registre des versements dus aux transporteurs (releve de payout).

    Chaque livraison confirmee genere une entree :
    - status="pending" : montant du mais non verse (rail non configure, sandbox, echec)
    - status="paid"    : verse avec succes au transporteur
    - status="failed"  : tentative de versement echouee (a rejouer)

    Permet de tracer toute somme due meme quand le versement ne peut aboutir
    (ex: transporteur sans config mobile money / Stripe, ou PawaPay pas encore en prod).
    """
    __tablename__ = "payout_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    carrier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id"), index=True
    )
    amount: Mapped[float] = mapped_column(Float)  # montant net du (apres penalites)
    currency: Mapped[str] = mapped_column(String(5), default="EUR")
    rail: Mapped[str] = mapped_column(String(20))  # stripe | pawapay | none
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # scheduled | pending | paid | failed
    failure_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)  # no_stripe_account | no_mobile_config | sandbox | api_error
    external_ref: Mapped[str | None] = mapped_column(String(200), nullable=True)  # id de transfert Stripe/PawaPay si verse
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Echeance d'execution (delivered + 48h) ; None = du immediatement
    due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    # Nombre de tentatives d'execution (plafond gere par le worker)
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")