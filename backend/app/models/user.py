import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # OAuth
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    apple_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)

    # Rôles
    is_sender: Mapped[bool] = mapped_column(Boolean, default=True)
    is_carrier: Mapped[bool] = mapped_column(Boolean, default=False)
    is_receiver: Mapped[bool] = mapped_column(Boolean, default=True)

    # KYC
    kyc_status: Mapped[str] = mapped_column(String(20), default="pending")
    onfido_applicant_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # KiparTrust
    trust_score: Mapped[float] = mapped_column(Float, default=50.0)

    # Paiements
    stripe_account_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    flutterwave_account_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    language: Mapped[str] = mapped_column(String(5), default="fr")
    fcm_token: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
