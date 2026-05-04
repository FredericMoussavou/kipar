from passlib.context import CryptContext
from datetime import datetime, timezone, timedelta
from app.models.booking import Booking

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_and_hash_code() -> tuple[str, str]:
    """
    Génère un code 6 chiffres et retourne (code_clair, code_hashé).
    On stocke le hash en base — jamais le code en clair.
    """
    code = Booking.generate_delivery_code()
    hashed = pwd_context.hash(code)
    return code, hashed


def verify_code(plain_code: str, hashed_code: str) -> bool:
    return pwd_context.verify(plain_code, hashed_code)


def code_expires_at() -> datetime:
    """Le code expire 30 jours après sa génération."""
    return datetime.now(timezone.utc) + timedelta(days=30)


async def get_plain_code_for_receiver(booking) -> str | None:
    """Retourne le code en clair pour le récepteur — None si déjà livré."""
    return booking.delivery_code_plain
