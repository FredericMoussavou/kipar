import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Float, DateTime, Integer, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
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
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    # Premium
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    premium_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    premium_plan: Mapped[str | None] = mapped_column(String(20), nullable=True)  # monthly | annual
    premium_stripe_sub_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    premium_flw_sub_id: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # KiparScan quota
    kiparscan_monthly_uses: Mapped[int] = mapped_column(Integer, default=0)
    kiparscan_reset_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_receiver: Mapped[bool] = mapped_column(Boolean, default=True)

    # KYC
    kyc_status: Mapped[str] = mapped_column(String(20), default="pending")
    onfido_applicant_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # KiparTrust
    trust_score: Mapped[float] = mapped_column(Float, default=50.0)

    # Paiements
    stripe_account_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mobile_money_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)  # ex: MTN_MOMO_CMR

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    language: Mapped[str] = mapped_column(String(5), default="fr")
    fcm_token: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Vérifications Phase 4-bis
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_temporary_password: Mapped[bool] = mapped_column(Boolean, default=False)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    kyc_id_front: Mapped[str | None] = mapped_column(String(500), nullable=True)
    kyc_id_back: Mapped[str | None] = mapped_column(String(500), nullable=True)
    kyc_selfie: Mapped[str | None] = mapped_column(String(500), nullable=True)
    username: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True, index=True)
    username_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Preferences notifications (Phase 2)
    notify_by_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_by_push: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_by_sms: Mapped[bool] = mapped_column(Boolean, default=False)
    weight_unit: Mapped[str] = mapped_column(String(5), default="kg", server_default="kg")

    # Preferences paiement / payout
    currency: Mapped[str] = mapped_column(String(5), default="EUR", server_default="EUR")
    payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payment_country: Mapped[str | None] = mapped_column(String(5), nullable=True)
    mobile_money_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    iban: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # 2FA
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    totp_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_2fa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Soft delete (Phase 2)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cgu_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
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

    notifications = relationship("Notification", back_populates="user", lazy="dynamic")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
