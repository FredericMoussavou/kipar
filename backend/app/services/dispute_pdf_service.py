import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT


RED = HexColor("#DC0029")
CHARCOAL = HexColor("#3D3D3D")
TAUPE = HexColor("#B5AFAB")
SAND = HexColor("#F0EDE8")
BG = HexColor("#FBFBFF")
GREEN = HexColor("#16A34A")
AMBER = HexColor("#F59E0B")

INCIDENT_LABELS = {
    "pickup_failed": "Non remis (pickup)",
    "delivery_failed": "Non livre (delivery)",
    "damaged": "Colis endommage",
    "lost": "Colis perdu",
    "wrong_content": "Mauvais contenu",
    "other": "Autre",
}
STAGE_LABELS = {
    "pickup": "A la remise",
    "transit": "En transit",
    "delivery": "A la livraison",
}
ROLE_LABELS = {
    "sender": "Expediteur",
    "carrier": "Transporteur",
    "receiver": "Recepteur",
}
STATUS_LABELS = {
    "open": "Ouvert",
    "resolved_sender": "Resolu - Expediteur",
    "resolved_carrier": "Resolu - Transporteur",
    "resolved_split": "Resolu - Partage",
    "cancelled": "Annule",
}


def fmt_date(d: str | None) -> str:
    if not d:
        return "N/A"
    try:
        return datetime.fromisoformat(d.replace("Z", "+00:00")).strftime("%d/%m/%Y %H:%M")
    except Exception:
        return d


def party_rows(party: dict | None, role: str) -> list:
    if not party:
        return []
    return [
        [f"{ROLE_LABELS.get(role, role).upper()}", ""],
        ["Nom", party.get("full_name", "N/A")],
        ["Email", party.get("email", "N/A")],
        ["Telephone", party.get("phone") or "N/A"],
        ["Adresse", party.get("address") or "N/A"],
        ["KiparTrust", f"{(party.get('trust_score') or 0):.0f}/100"],
    ]


def generate_dispute_pdf(dispute: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm, leftMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", fontSize=22, textColor=RED, fontName="Helvetica-Bold", spaceAfter=2*mm)
    subtitle_style = ParagraphStyle("subtitle", fontSize=11, textColor=TAUPE, fontName="Helvetica", spaceAfter=6*mm)
    section_style = ParagraphStyle("section", fontSize=12, textColor=white, fontName="Helvetica-Bold", spaceAfter=0, spaceBefore=4*mm)
    body_style = ParagraphStyle("body", fontSize=10, textColor=CHARCOAL, fontName="Helvetica", spaceAfter=2*mm, leading=14)

    def section_header(title: str) -> Table:
        t = Table([[title]], colWidths=[170*mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), RED),
            ("TEXTCOLOR", (0,0), (-1,-1), white),
            ("FONTNAME", (0,0), (-1,-1), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 11),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("LEFTPADDING", (0,0), (-1,-1), 8),
        ]))
        return t

    def data_table(rows: list, col_widths=[60*mm, 110*mm]) -> Table:
        t = Table(rows, colWidths=col_widths)
        t.setStyle(TableStyle([
            ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
            ("FONTSIZE", (0,0), (-1,-1), 9),
            ("TEXTCOLOR", (0,0), (-1,-1), CHARCOAL),
            ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
            ("TEXTCOLOR", (0,0), (0,-1), CHARCOAL),
            ("BACKGROUND", (0,0), (-1,0), SAND),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("SPAN", (0,0), (-1,0)),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("GRID", (0,0), (-1,-1), 0.3, TAUPE),
        ]))
        return t

    story = []

    # En-tete
    story.append(Paragraph("KIPAR.", title_style))
    story.append(Paragraph(f"Dossier de litige #{str(dispute.get('id', ''))[:8].upper()}", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=RED, spaceAfter=4*mm))

    # Informations generales
    story.append(section_header("INFORMATIONS GENERALES"))
    story.append(Spacer(1, 2*mm))
    general_rows = [
        ["INFORMATIONS GENERALES", ""],
        ["Statut", STATUS_LABELS.get(dispute.get("status", ""), dispute.get("status", "N/A"))],
        ["Type d'incident", INCIDENT_LABELS.get(dispute.get("incident_type", ""), dispute.get("incident_type", "N/A"))],
        ["Moment de l'incident", STAGE_LABELS.get(dispute.get("incident_stage", ""), dispute.get("incident_stage", "N/A"))],
        ["Declare par", ROLE_LABELS.get(dispute.get("initiated_by_role", ""), dispute.get("initiated_by_role", "N/A"))],
        ["Date d'ouverture", fmt_date(dispute.get("created_at"))],
        ["Date de resolution", fmt_date(dispute.get("resolved_at"))],
        ["Assurance souscrite", "Oui" if dispute.get("has_insurance") else "Non"],
    ]
    story.append(data_table(general_rows))
    story.append(Spacer(1, 4*mm))

    # Parties
    story.append(section_header("PARTIES"))
    story.append(Spacer(1, 2*mm))
    for role in ["sender", "carrier", "receiver"]:
        party = dispute.get(role)
        if party:
            rows = party_rows(party, role)
            story.append(data_table(rows))
            story.append(Spacer(1, 2*mm))

    # Booking
    booking = dispute.get("booking")
    if booking:
        story.append(section_header("BOOKING"))
        story.append(Spacer(1, 2*mm))
        booking_rows = [
            ["BOOKING", ""],
            ["Montant", f"{booking.get('amount', 'N/A')} {booking.get('currency', 'EUR')}"],
            ["Statut booking", booking.get("status", "N/A")],
        ]
        trip = dispute.get("trip")
        if trip:
            booking_rows += [
                ["Corridor", f"{trip.get('origin', '')} -> {trip.get('destination', '')}"],
                ["Date de depart", trip.get("departure_date", "N/A")],
                ["Numero de vol", trip.get("flight_number") or "N/A"],
            ]
        story.append(data_table(booking_rows))
        story.append(Spacer(1, 4*mm))

    # Colis
    pkg = dispute.get("package")
    if pkg:
        story.append(section_header("COLIS"))
        story.append(Spacer(1, 2*mm))
        pkg_rows = [
            ["COLIS", ""],
            ["Description", pkg.get("content_description", "N/A")],
            ["Valeur declaree", f"{pkg.get('declared_value', 'N/A')} EUR" if pkg.get("declared_value") else "Non renseignee"],
            ["Poids", f"{pkg.get('weight_kg', 'N/A')} kg"],
            ["Photos colis", str(len(pkg.get("photo_urls", []))) + " photo(s) disponible(s) en ligne"],
        ]
        story.append(data_table(pkg_rows))
        story.append(Spacer(1, 4*mm))

    # Motif et preuves
    story.append(section_header("MOTIF ET PREUVES"))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(f"<b>Motif declare :</b> {dispute.get('reason', 'N/A')}", body_style))
    if dispute.get("evidence_urls"):
        story.append(Paragraph(f"<b>Photos preuves declarant :</b> {len(dispute['evidence_urls'])} photo(s)", body_style))
        for url in dispute["evidence_urls"]:
            story.append(Paragraph(f"  - {url}", body_style))
    if dispute.get("respondent_comment"):
        story.append(Paragraph(f"<b>Reponse partie adverse :</b> {dispute['respondent_comment']}", body_style))
    if dispute.get("respondent_evidence_urls"):
        story.append(Paragraph(f"<b>Photos preuves partie adverse :</b> {len(dispute['respondent_evidence_urls'])} photo(s)", body_style))
    story.append(Spacer(1, 4*mm))

    # Timeline
    story.append(section_header("TIMELINE"))
    story.append(Spacer(1, 2*mm))
    timeline = dispute.get("timeline", {})
    tl_rows = [
        ["TIMELINE", ""],
        ["Litige ouvert", fmt_date(timeline.get("created_at"))],
        ["Pickup failed", fmt_date(timeline.get("pickup_failed_at"))],
        ["Delivery failed", fmt_date(timeline.get("delivery_failed_at"))],
        ["Echeance reponse", fmt_date(timeline.get("incident_response_deadline"))],
        ["Resolu le", fmt_date(timeline.get("resolved_at"))],
    ]
    story.append(data_table(tl_rows))
    story.append(Spacer(1, 4*mm))

    # Resolution
    if dispute.get("resolution"):
        story.append(section_header("RESOLUTION ADMIN"))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(dispute["resolution"], body_style))
        story.append(Spacer(1, 4*mm))

    # Assurance
    if dispute.get("has_insurance"):
        story.append(section_header("ASSURANCE"))
        story.append(Spacer(1, 2*mm))
        ins_rows = [
            ["ASSURANCE", ""],
            ["Dossier envoye assureur", "Oui" if dispute.get("insurer_dossier_sent") else "Non"],
            ["Date envoi", fmt_date(dispute.get("insurer_dossier_sent_at"))],
            ["Reference assureur", dispute.get("insurer_reference") or "En attente"],
            ["Indemnisation", f"{dispute.get('insurance_payout', 0):.2f} EUR"],
        ]
        story.append(data_table(ins_rows))
        story.append(Spacer(1, 4*mm))

    # Pied de page
    story.append(HRFlowable(width="100%", thickness=0.5, color=TAUPE))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        f"Document genere par KIPAR. le {datetime.now().strftime('%d/%m/%Y a %H:%M')} | Confidentiel",
        ParagraphStyle("footer", fontSize=8, textColor=TAUPE, alignment=TA_CENTER)
    ))

    doc.build(story)
    return buffer.getvalue()
