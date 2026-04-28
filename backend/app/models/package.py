import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Package(Base):
    __tablename__ = "packages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    receiver_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )

    # Contenu
    weight_kg: Mapped[float] = mapped_column(Float)
    length_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    width_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    content_description: Mapped[str] = mapped_column(String(500))
    declared_value: Mapped[float] = mapped_column(Float, default=0.0)

    # Photos (URLs S3)
    photo_urls: Mapped[list] = mapped_column(JSON, default=list)

    # KiparScan — résultat analyse IA
    ai_scan_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ai_prohibited_flag: Mapped[bool] = mapped_column(Boolean, default=False)

    pickup_location: Mapped[str | None] = mapped_column(String(300), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    # Relations
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    receiver: Mapped["User | None"] = relationship("User", foreign_keys=[receiver_id])
    booking: Mapped["Booking | None"] = relationship(
        "Booking", back_populates="package", uselist=False
    )
