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


async def send_sms_verification(phone: str) -> bool:
    """Envoie un code OTP via Twilio Verify."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_VERIFY_SERVICE_SID:
        logger.info(f"[SMS SIMULATED] Code envoye au {phone}")
        return True
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verifications.create(
            to=phone,
            channel="sms",
        )
        return True
    except Exception as e:
        logger.error(f"Twilio Verify error: {e}")
        return False


async def check_sms_verification(phone: str, code: str) -> bool:
    """Verifie un code OTP via Twilio Verify."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_VERIFY_SERVICE_SID:
        logger.info(f"[SMS SIMULATED] Code {code} verifie pour {phone}")
        return code == "123456"  # code de test en simulation
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        result = client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verification_checks.create(
            to=phone,
            code=code,
        )
        return result.status == "approved"
    except Exception as e:
        logger.error(f"Twilio Verify check error: {e}")
        return False


async def send_sms_code(phone: str, code: str) -> bool:
    """Deprecated - utiliser send_sms_verification."""
    return await send_sms_verification(phone)
