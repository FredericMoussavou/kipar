import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id"), unique=True, index=True
    )
    opened_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    # non_delivery / damaged / lost_airline / refused_code / wrong_content
    claim_type: Mapped[str] = mapped_column(String(30))
    # open / in_review / resolved_sender / resolved_carrier / closed
    status: Mapped[str] = mapped_column(String(30), default="open")

    description: Mapped[str] = mapped_column(Text)
    evidence_urls: Mapped[list] = mapped_column(JSON, default=list)
    pir_document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    insurance_payout: Mapped[float] = mapped_column(Float, default=0.0)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    booking: Mapped["Booking"] = relationship("Booking")
