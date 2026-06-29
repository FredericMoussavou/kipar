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
    TURNSTILE_SECRET: str = ""

    # PawaPay
    PAWAPAY_API_TOKEN: str = ""
    PAWAPAY_BASE_URL: str = "https://api.sandbox.pawapay.io"

    # Twilio
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    TWILIO_VERIFY_SERVICE_SID: str = ""

    # Resend
    RESEND_API_KEY: str = ""

    # Onfido
    ONFIDO_API_TOKEN: str = ""  # Deprecated - conserve pour compatibilite
    IDENFY_API_KEY: str = ""
    IDENFY_API_SECRET: str = ""
    IDENFY_BASE_URL: str = "https://ivs.idenfy.com"

    # AviationStack
    AIRLABS_API_KEY: str = ""  # Cle AirLabs pour tracking vol

    ANTHROPIC_API_KEY: str = ""

    # Cloudinary (avatars)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_UPLOAD_PRESET: str = "kipar_avatars"

    SENTRY_DSN: str = ""

    SUPPORT_EMAIL: str = "support@kipar.app"

    # Frais de service - modele financier v2
    SERVICE_FEE_SENDER_PERCENT: float = 0.13     # 13% cote expediteur
    SERVICE_FEE_CARRIER_PERCENT: float = 0.02    # 2% cote transporteur
    PENDING_KYC_TTL_HOURS: int = 48              # TTL pre-reservation pending_kyc (heures)
    BOOKING_FLAT_FEE: float = 3.0                # Forfait dossier a la confirmation
    URGENT_FLAT_FEE: float = 10.0                # Forfait dossier urgence
    URGENT_FEE_KIPAR: float = 4.0                # Part KIPAR sur forfait urgence
    URGENT_FEE_CARRIER: float = 6.0              # Part transporteur sur forfait urgence
    SMALL_PACKAGE_MAX_KG: float = 1.0            # Seuil poids petit colis (kg)
    SMALL_PACKAGE_PRICE: float = 15.0            # Prix fixe max expediteur petit colis
    SMALL_PACKAGE_KIPAR_FEE: float = 5.0         # Part KIPAR sur petit colis
    SMALL_PACKAGE_CARRIER_MAX: float = 10.0      # Part max transporteur sur petit colis
    SMALL_PACKAGE_CARRIER_MIN: float = 5.0       # Part min transporteur sur petit colis
    BOOKING_URGENT_THRESHOLD_HOURS: float = 36.0  # <= ce delai (h) avant depart = urgent
    BOOKING_MIN_HOURS_BEFORE_DEPARTURE: float = 5.0  # en dessous, booking refuse
    TRIP_PUBLISH_URGENT_MIN_HOURS: float = 72.0  # delai mini publication trajet urgent (h)
    TRIP_PUBLISH_NORMAL_MIN_HOURS: float = 168.0  # delai mini publication trajet normal (7j)
    MIN_COMMISSION: float = 2.50                 # Commission minimum absolue
    CARRIER_CANCEL_FEE_PERCENT: float = 0.05     # 5% annulation transporteur non justifiee
    CARRIER_CANCEL_FEE_MIN: float = 5.00         # Plancher annulation transporteur
    DISPUTE_FEE: float = 10.00                   # Frais litige conteste (a charge du fautif)
    LATE_CANCEL_HOURS: int = 72                  # Seuil annulation tardive expediteur
    SENDER_CANCEL_MID_HOURS: int = 24
    SENDER_CANCEL_MID_REFUND_PERCENT: float = 0.50
    SENDER_CANCEL_MID_CARRIER_PERCENT: float = 0.25
    SENDER_CANCEL_LATE_CARRIER_PERCENT: float = 0.83
    MAX_EVIDENCE_FILES: int = 5
    INCIDENT_RESPONSE_HOURS: int = 48            # Fenetre justification pickup/delivery failed
    LISTING_MIN_DELAY_HOURS: int = 24            # Delai min avant suppression annonce
    PENDING_BOOKING_TTL_HOURS: int = 1           # Reservation non payee retenue 1h max
    CARRIER_ACCEPT_TTL_HOURS: int = 48           # Delai acceptation transporteur (vol normal)
    CARRIER_ACCEPT_TTL_URGENT_HOURS: int = 24    # Delai acceptation transporteur (vol urgent)
    PRICE_SUGGESTION_WINDOW_DAYS: int = 90       # Historique fourchette prix corridor
    PRICE_SUGGESTION_MIN_SAMPLES: int = 5        # Seuil donnees corridor suffisantes
    DELIVERY_TIMEOUT_DAYS: int = 7               # Timeout livraison sans confirmation
    INSURANCE_ENABLED: bool = False    # Active quand partenariat assureur signe
    INSURANCE_RATE_TYPE: str = 'percent'  # 'percent' ou 'fixed'
    INSURANCE_RATE_VALUE: float = 0.03   # 3% si percent, ou montant fixe si fixed
    INSURANCE_RATE_DEFAULT: float = 0.03  # 3% valeur declaree (legacy)
    INSURANCE_SELF_COVER_MAX: float = 200.0  # Auto-assurance Kipar sous ce seuil
    INSURANCE_RATE_MIN: float = 0.02   # 2% valeur déclarée
    INSURANCE_RATE_MAX: float = 0.04   # 4% valeur déclarée

    DEEPL_API_KEY: str = ""

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    APPLE_CLIENT_ID: str = ""  # ex: com.kipar.app

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


settings = Settings()
