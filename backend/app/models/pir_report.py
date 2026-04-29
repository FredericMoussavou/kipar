import uuid
import secrets
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class PIRReport(Base):
    """
    Property Irregularity Report — signalement de bagage perdu par la compagnie aérienne.
    Procédure Convention de Montréal : 21 jours pour retrouver le bagage.
    """
    __tablename__ = "pir_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trips.id"), unique=True, index=True
    )
    carrier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    # Document PIR fourni par la compagnie aérienne à l'aéroport
    pir_document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    airline_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Statut : open / searching / found / lost_confirmed
    status: Mapped[str] = mapped_column(String(30), default="open")

    # Dates clés de la procédure Convention de Montréal
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    deadline_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )  # J+21
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Résolution
    found: Mapped[bool] = mapped_column(Boolean, default=False)
    resolution_note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # IDs des bookings affectés (tous les colis du trajet)
    affected_booking_ids: Mapped[list] = mapped_column(JSON, default=list)
