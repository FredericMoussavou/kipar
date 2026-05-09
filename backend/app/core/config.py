from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    # App
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "null"]

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://kipar:kipar_dev@localhost:5432/kipar_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "dev-secret-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Flutterwave
    FLUTTERWAVE_SECRET_KEY: str = ""

    # Twilio
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # Resend
    RESEND_API_KEY: str = ""

    # Onfido
    ONFIDO_API_TOKEN: str = ""

    # AviationStack
    AVIATIONSTACK_API_KEY: str = ""

    ANTHROPIC_API_KEY: str = ""

    # Cloudinary (avatars)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_UPLOAD_PRESET: str = "kipar_avatars"

    SENTRY_DSN: str = ""

    SUPPORT_EMAIL: str = "support@kipar.app"

    # Frais de service - modele financier v2
    SERVICE_FEE_SENDER_PERCENT: float = 0.15     # 15% cote expediteur
    SERVICE_FEE_CARRIER_PERCENT: float = 0.02    # 2% cote transporteur
    BOOKING_FLAT_FEE: float = 1.50               # Forfait dossier a la confirmation
    MIN_COMMISSION: float = 2.50                 # Commission minimum absolue
    CARRIER_CANCEL_FEE_PERCENT: float = 0.05     # 5% annulation transporteur non justifiee
    CARRIER_CANCEL_FEE_MIN: float = 5.00         # Plancher annulation transporteur
    DISPUTE_FEE: float = 10.00                   # Frais litige conteste (a charge du fautif)
    LATE_CANCEL_HOURS: int = 72                  # Seuil annulation tardive expediteur
    INCIDENT_RESPONSE_HOURS: int = 48            # Fenetre justification pickup/delivery failed
    LISTING_MIN_DELAY_HOURS: int = 24            # Delai min avant suppression annonce
    PRICE_SUGGESTION_WINDOW_DAYS: int = 90       # Historique fourchette prix corridor
    PRICE_SUGGESTION_MIN_SAMPLES: int = 5        # Seuil donnees corridor suffisantes
    DELIVERY_TIMEOUT_DAYS: int = 7               # Timeout livraison sans confirmation
    INSURANCE_ENABLED: bool = False    # Active quand partenariat assureur signe
    INSURANCE_RATE_DEFAULT: float = 0.03  # 3% valeur declaree
    INSURANCE_SELF_COVER_MAX: float = 200.0  # Auto-assurance Kipar sous ce seuil
    INSURANCE_RATE_MIN: float = 0.02   # 2% valeur déclarée
    INSURANCE_RATE_MAX: float = 0.04   # 4% valeur déclarée
    INSURANCE_RATE_DEFAULT: float = 0.03  # 3% par défaut

    DEEPL_API_KEY: str = ""

    GOOGLE_CLIENT_ID: str = ""
    APPLE_CLIENT_ID: str = ""  # ex: com.kipar.app

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


settings = Settings()
