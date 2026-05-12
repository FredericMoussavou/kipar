import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    carrier_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), index=True
    )

    # Itinéraire
    origin_city: Mapped[str] = mapped_column(String(100))
    origin_airport_code: Mapped[str] = mapped_column(String(3))       # ex: CDG
    destination_city: Mapped[str] = mapped_column(String(100))
    destination_airport_code: Mapped[str] = mapped_column(String(3))  # ex: DSS

    # Vol
    departure_date: Mapped[date] = mapped_column(Date, index=True)
    departure_time: Mapped[str | None] = mapped_column(String(5), nullable=True)   # ex: 14:30
    arrival_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    arrival_time: Mapped[str | None] = mapped_column(String(5), nullable=True)     # ex: 18:45
    flight_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    airline: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Capacité
    total_kg: Mapped[float] = mapped_column(Float)
    remaining_kg: Mapped[float] = mapped_column(Float)
    max_kg_per_package: Mapped[float] = mapped_column(Float, default=5.0)
    price_per_kg: Mapped[float] = mapped_column(Float)
    weight_unit: Mapped[str] = mapped_column(String(5), default="kg")  # kg | lb
    currency: Mapped[str] = mapped_column(String(5), default="EUR")  # ISO 4217

    # Statut : open / full / in_transit / completed / cancelled
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relations
    carrier: Mapped["User"] = relationship("User", foreign_keys=[carrier_id])
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="trip")
