import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class FlightTracking(Base):
    __tablename__ = "flight_tracking"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trips.id"), unique=True, index=True
    )

    flight_number: Mapped[str] = mapped_column(String(20))
    airline: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # scheduled / boarding / in_air / landed / delayed / cancelled
    status: Mapped[str] = mapped_column(String(20), default="scheduled")

    departure_scheduled: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    departure_actual: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    arrival_estimated: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    arrival_actual: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Champs AirLabs
    dep_iata: Mapped[str | None] = mapped_column(String(10), nullable=True)
    arr_iata: Mapped[str | None] = mapped_column(String(10), nullable=True)
    delayed_minutes: Mapped[int | None] = mapped_column(nullable=True)

    trip: Mapped["Trip"] = relationship("Trip")
