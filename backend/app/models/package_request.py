import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Float, Boolean, Date, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from app.core.database import Base


class PackageRequest(Base):
    __tablename__ = "package_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)

    # Itinéraire
    origin_city: Mapped[str] = mapped_column(String(100))
    origin_airport_code: Mapped[str] = mapped_column(String(3), index=True)
    destination_city: Mapped[str] = mapped_column(String(100))
    destination_airport_code: Mapped[str] = mapped_column(String(3), index=True)

    # Colis
    content_description: Mapped[str] = mapped_column(Text)
    weight_kg: Mapped[float] = mapped_column(Float)
    package_mode: Mapped[str] = mapped_column(String(8), default="kg")  # kg | small
    declared_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    budget_per_kg: Mapped[float] = mapped_column(Float)
    photos: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)

    # Récepteur
    receiver_email_or_phone: Mapped[str] = mapped_column(String(200))

    # Dates
    deadline_date: Mapped[date] = mapped_column(Date, index=True)

    # Statut : open / matched / expired / cancelled
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relations
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    applications: Mapped[list["Application"]] = relationship("Application", back_populates="package_request")


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    package_request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("package_requests.id"), index=True
    )
    carrier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), index=True)

    # Statut : pending / accepted / refused
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relations
    package_request: Mapped["PackageRequest"] = relationship("PackageRequest", back_populates="applications")
    carrier: Mapped["User"] = relationship("User", foreign_keys=[carrier_id])
    trip: Mapped["Trip"] = relationship("Trip")
