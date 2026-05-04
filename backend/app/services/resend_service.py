import resend
from app.core.config import settings

resend.api_key = settings.RESEND_API_KEY

FROM_EMAIL = "Kipar <onboarding@resend.dev>"  # Remplacer par noreply@kipar.app en prod


async def send_receiver_invitation(
    to_email: str,
    receiver_first_name: str,
    sender_full_name: str,
    origin: str,
    destination: str,
    content_description: str,
    token: str,
    temp_password: str | None,
    lang: str = "fr",
) -> None:
    """Envoie le lien magique au récepteur avec les détails du colis."""
    frontend_url = settings.FRONTEND_URL
    link = f"{frontend_url}/receiver/{token}"

    subjects = {
        "fr": f"{sender_full_name} vous envoie un colis via Kipar",
        "en": f"{sender_full_name} is sending you a package via Kipar",
        "es": f"{sender_full_name} te envía un paquete a través de Kipar",
    }
    subject = subjects.get(lang, subjects["fr"])

    if lang == "en":
        intro = f"Hello {receiver_first_name},"
        body_lines = [
            f"{sender_full_name} is sending you a package via Kipar.",
            f"<b>Route:</b> {origin} → {destination}",
            f"<b>Contents:</b> {content_description}",
            "Click the button below to view the details and confirm receipt.",
        ]
        btn_label = "View my package"
        pwd_label = "Your temporary password" if temp_password else None
        pwd_note = "You can change it after your first login." if temp_password else None
    elif lang == "es":
        intro = f"Hola {receiver_first_name},"
        body_lines = [
            f"{sender_full_name} te está enviando un paquete a través de Kipar.",
            f"<b>Ruta:</b> {origin} → {destination}",
            f"<b>Contenido:</b> {content_description}",
            "Haz clic en el botón de abajo para ver los detalles y confirmar la recepción.",
        ]
        btn_label = "Ver mi paquete"
        pwd_label = "Tu contraseña temporal" if temp_password else None
        pwd_note = "Puedes cambiarla tras tu primer inicio de sesión." if temp_password else None
    else:
        intro = f"Bonjour {receiver_first_name},"
        body_lines = [
            f"{sender_full_name} vous envoie un colis via Kipar.",
            f"<b>Trajet :</b> {origin} → {destination}",
            f"<b>Contenu :</b> {content_description}",
            "Cliquez sur le bouton ci-dessous pour voir les détails et confirmer la réception.",
        ]
        btn_label = "Voir mon colis"
        pwd_label = "Votre mot de passe temporaire" if temp_password else None
        pwd_note = "Vous pourrez le modifier après votre première connexion." if temp_password else None

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 28px; font-weight: 900; color: #1a1a1a; letter-spacing: -1px;">
          KI<span style="color: #c0392b;">PAR</span>
        </h1>
      </div>
      <p style="font-size: 16px; color: #1a1a1a;">{intro}</p>
      {"".join(f'<p style="font-size: 15px; color: #444;">{line}</p>' for line in body_lines)}
      {"".join([
          f'<div style="background: #f5f3f0; border-radius: 10px; padding: 16px; margin: 20px 0;">',
          f'<p style="font-size: 12px; color: #888; margin: 0 0 4px;">{pwd_label}</p>',
          f'<p style="font-size: 20px; font-weight: 700; color: #1a1a1a; font-family: monospace; margin: 0;">{temp_password}</p>',
          f'<p style="font-size: 12px; color: #888; margin: 8px 0 0;">{pwd_note}</p>',
          '</div>',
      ]) if temp_password else ""}
      <div style="text-align: center; margin: 32px 0;">
        <a href="{link}"
           style="background: #c0392b; color: white; text-decoration: none; padding: 14px 32px;
                  border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block;">
          {btn_label}
        </a>
      </div>
      <p style="font-size: 12px; color: #aaa; text-align: center;">
        Kipar · Ce lien est valable 24h
      </p>
    </div>
    """

    params = resend.Emails.SendParams(
        from_=FROM_EMAIL,
        to=[to_email],
        subject=subject,
        html=body_html,
    )
    # En dev sans clé réelle → on logue sans crasher
    if not settings.RESEND_API_KEY:
        print(f"[RESEND SIMULATION] To: {to_email} | Link: {link}")
        return
    resend.Emails.send(params)
