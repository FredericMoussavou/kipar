import json
import logging
from app.core.config import settings
from app.i18n.loader import t

logger = logging.getLogger(__name__)


def get_firebase_app():
    """Initialise Firebase une seule fois."""
    if not settings.FIREBASE_CREDENTIALS_JSON:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials
        if not firebase_admin._apps:
            cred_dict = json.loads(settings.FIREBASE_CREDENTIALS_JSON)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
        return firebase_admin.get_app()
    except Exception as e:
        logger.warning(f"Firebase init failed: {e}")
        return None


async def send_push(
    fcm_token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """
    Envoie une notification push via Firebase Cloud Messaging.
    Retourne True si succès, False si échec ou pas de config.
    """
    app = get_firebase_app()
    if not app:
        # Mode simulation — log uniquement
        logger.info(f"[PUSH SIMULATED] {title}: {body}")
        return True

    try:
        from firebase_admin import messaging
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=fcm_token,
        )
        messaging.send(message)
        return True
    except Exception as e:
        logger.error(f"Push notification failed: {e}")
        return False


async def send_sms(phone: str, message: str) -> bool:
    """
    Envoie un SMS via Twilio.
    Retourne True si succès, False si échec ou pas de config.
    """
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.info(f"[SMS SIMULATED] → {phone}: {message}")
        return True

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=phone,
        )
        return True
    except Exception as e:
        logger.error(f"SMS failed: {e}")
        return False


async def send_email(to: str, subject: str, html: str) -> bool:
    """Envoie un email via Resend."""
    if not settings.RESEND_API_KEY:
        logger.info(f"[EMAIL SIMULATED] → {to}: {subject}")
        return True

    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": "KIPAR. <noreply@kipar.app>",
            "to": to,
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as e:
        logger.error(f"Email failed: {e}")
        return False


# ── Notifications métier Kipar ──

async def notify_booking_received(
    carrier_fcm_token: str | None,
    carrier_phone: str | None,
    carrier_email: str,
    route: str,
    lang: str = "fr",
) -> None:
    """Notifie le transporteur d'une nouvelle demande de colis."""
    body = t("notifications.booking_received", lang, route=route)
    if carrier_fcm_token:
        await send_push(carrier_fcm_token, "KIPAR.", body)
    if carrier_phone:
        await send_sms(carrier_phone, f"KIPAR. — {body}")
    await send_email(carrier_email, "KIPAR. — Nouvelle demande", f"<p>{body}</p>")


async def notify_booking_accepted(
    sender_fcm_token: str | None,
    sender_phone: str | None,
    sender_email: str,
    lang: str = "fr",
) -> None:
    """Notifie l'expéditeur que sa demande a été acceptée."""
    body = t("notifications.booking_accepted", lang)
    if sender_fcm_token:
        await send_push(sender_fcm_token, "KIPAR.", body)
    if sender_phone:
        await send_sms(sender_phone, f"KIPAR. — {body}")
    await send_email(sender_email, "KIPAR. — Demande acceptée", f"<p>{body}</p>")


async def notify_delivery_code(
    receiver_fcm_token: str | None,
    receiver_phone: str | None,
    receiver_email: str,
    code: str,
    carrier_name: str,
    flight_number: str | None,
    lang: str = "fr",
) -> None:
    """
    Envoie le code de remise directement au récepteur.
    C'est la notification la plus importante de Kipar.
    """
    body = f"Votre code de remise : {code}" if lang == "fr" else f"Your delivery code: {code}"
    detail = f"Transporteur : {carrier_name}"
    if flight_number:
        detail += f" · Vol {flight_number}"

    if receiver_fcm_token:
        await send_push(receiver_fcm_token, "KIPAR. — Code de remise", body, {
            "code": code,
            "carrier_name": carrier_name,
            "flight_number": flight_number or "",
        })
    if receiver_phone:
        await send_sms(receiver_phone, f"KIPAR. — {body} | {detail}")
    await send_email(
        receiver_email,
        "KIPAR. — Votre code de remise",
        f"<h2>{body}</h2><p>{detail}</p>"
    )


async def notify_delivery_confirmed(
    user_fcm_token: str | None,
    user_phone: str | None,
    user_email: str,
    lang: str = "fr",
) -> None:
    """Notifie l'expéditeur que son colis a été livré."""
    messages = {
        "fr": ("Colis livré !", "Votre colis a été remis au récepteur. Les fonds sont débloqués."),
        "en": ("Package delivered!", "Your package has been handed over. Funds are released."),
        "es": ("¡Paquete entregado!", "Tu paquete fue entregado. Los fondos están liberados."),
    }
    title, body = messages.get(lang, messages["fr"])
    if user_fcm_token:
        await send_push(user_fcm_token, title, body, {})
    if user_phone:
        await send_sms(user_phone, f"KIPAR. — {body}")
    await send_email(user_email, f"KIPAR. — {title}", f"<h2>{title}</h2><p>{body}</p>")


async def notify_flight_status(
    sender_fcm_token: str | None,
    receiver_fcm_token: str | None,
    status: str,
    arrival: str | None = None,
    lang: str = "fr",
) -> None:
    """Notifie expéditeur et récepteur d'un changement de statut de vol."""
    if status == "landed":
        body = t("notifications.flight_landed", lang)
    elif status == "delayed":
        body = t("notifications.flight_delayed", lang, arrival=arrival or "inconnue")
    else:
        body = t("notifications.flight_departed", lang, arrival=arrival or "inconnue")

    for token in [sender_fcm_token, receiver_fcm_token]:
        if token:
            await send_push(token, "KIPAR. — Vol", body)
