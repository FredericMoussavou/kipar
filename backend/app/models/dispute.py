import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id"), unique=True, index=True
    )

    # Declarant
    initiated_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    initiated_by_role: Mapped[str] = mapped_column(String(10), default="sender")  # sender | carrier | receiver

    # Type et contexte
    incident_type: Mapped[str] = mapped_column(String(30), default="other")
    # pickup_failed | delivery_failed | damaged | lost | wrong_content | other
    incident_stage: Mapped[str] = mapped_column(String(20), default="delivery")
    # pickup | transit | delivery

    # Motif et preuves - declarant
    reason: Mapped[str] = mapped_column(Text)
    evidence_urls: Mapped[list] = mapped_column(JSON, default=list)  # max 5 photos Cloudinary

    # Reponse partie adverse
    respondent_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    respondent_evidence_urls: Mapped[list] = mapped_column(JSON, default=list)

    # Valeur et assurance
    declared_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    has_insurance: Mapped[bool] = mapped_column(Boolean, default=False)
    insurance_payout: Mapped[float] = mapped_column(Float, default=0.0)

    # Routage assureur
    insurer_dossier_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    insurer_dossier_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    insurer_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Notes admin (non visibles utilisateurs)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Conversation liee
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Statut
    # open | in_review | resolved_sender | resolved_carrier | resolved_split | cancelled
    status: Mapped[str] = mapped_column(String(30), default="open")

    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relations
    booking: Mapped["Booking"] = relationship("Booking")
    initiator: Mapped["User"] = relationship("User", foreign_keys=[initiated_by])
    resolver: Mapped["User | None"] = relationship("User", foreign_keys=[resolved_by])
