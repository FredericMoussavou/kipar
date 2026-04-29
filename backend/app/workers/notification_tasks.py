import logging
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.notification_tasks.send_push_task")
def send_push_task(fcm_token: str, title: str, body: str, data: dict = None):
    """Tâche async pour envoyer une notification push."""
    import asyncio
    from app.services.notification_service import send_push
    asyncio.run(send_push(fcm_token, title, body, data))


@celery_app.task(name="app.workers.notification_tasks.send_sms_task")
def send_sms_task(phone: str, message: str):
    """Tâche async pour envoyer un SMS."""
    import asyncio
    from app.services.notification_service import send_sms
    asyncio.run(send_sms(phone, message))


@celery_app.task(name="app.workers.notification_tasks.send_invitation_task")
def send_invitation_task(contact: str, token: str, sender_name: str, lang: str = "fr"):
    """
    Envoie l'invitation au récepteur non inscrit.
    Appelé par create_booking quand le récepteur n'a pas de compte.
    """
    import asyncio
    from app.services.notification_service import send_sms, send_email
    from app.i18n.loader import t

    invite_url = f"https://kipar.app/join?token={token}"

    if lang == "fr":
        body = f"{sender_name} vous invite à recevoir un colis via KIPAR. Créez votre compte : {invite_url}"
        subject = "KIPAR. — Vous avez un colis à recevoir"
    else:
        body = f"{sender_name} invites you to receive a package via KIPAR. Create your account: {invite_url}"
        subject = "KIPAR. — You have a package to receive"

    async def _run():
        if "@" in contact:
            await send_email(contact, subject, f"<p>{body}</p>")
        else:
            await send_sms(contact, body)

    asyncio.run(_run())
