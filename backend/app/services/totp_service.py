import pyotp
import qrcode
import io
import base64
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

ISSUER = "KIPAR"


def generate_totp_secret() -> str:
    """Genere un secret TOTP aleatoire."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    """Retourne l'URI otpauth:// pour le QR code."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=ISSUER)


def generate_qr_code_base64(secret: str, email: str) -> str:
    """Genere un QR code en base64 PNG."""
    uri = get_totp_uri(secret, email)
    img = qrcode.make(uri)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode()


def verify_totp_code(secret: str, code: str) -> bool:
    """Verifie un code TOTP (fenetre de 1 periode = 30s avant/apres)."""
    try:
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)
    except Exception:
        return False


async def send_sms_code(phone: str, code: str) -> bool:
    """Envoie un code SMS via Twilio."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.info(f"[SMS SIMULATED] Code {code} envoye au {phone}")
        return True
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=f"Votre code KIPAR : {code}",
            from_=settings.TWILIO_PHONE_NUMBER,
            to=phone,
        )
        return True
    except Exception as e:
        logger.error(f"Twilio SMS error: {e}")
        return False
