import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# --- Palette KIPAR ---
RED      = HexColor("#DC0029")
CHARCOAL = HexColor("#3D3D3D")
TAUPE    = HexColor("#B5AFAB")
SAND     = HexColor("#F0EDE8")
BG       = HexColor("#FBFBFF")
GREEN    = HexColor("#16A34A")
AMBER    = HexColor("#F59E0B")

# Largeur utile : A4 = 210mm, marges 20mm x2 → 170mm
# On réserve 2mm de marge interne pour éviter tout débordement
PAGE_W = 168 * mm
COL1   = 58 * mm
COL2   = PAGE_W - COL1   # 110mm

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
    label = ROLE_LABELS.get(role, role).upper()
    return [
        [label, ""],
        ["Nom",       party.get("full_name", "N/A")],
        ["Email",     party.get("email", "N/A")],
        ["Telephone", party.get("phone") or "N/A"],
        ["Adresse",   party.get("address") or "N/A"],
        ["KiparTrust", f"{(party.get('trust_score') or 0):.0f}/100"],
    ]


def generate_dispute_pdf(dispute: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    # --- Styles ---
    body_style = ParagraphStyle(
        "body",
        fontSize=10,
        textColor=CHARCOAL,
        fontName="Helvetica",
        spaceAfter=2 * mm,
        leading=14,
    )
    footer_style = ParagraphStyle(
        "footer",
        fontSize=8,
        textColor=TAUPE,
        fontName="Helvetica",
        alignment=TA_CENTER,
    )

    # --- Helpers ---

    def section_header(title: str) -> Table:
        """Bandeau rouge pleine largeur avec titre blanc."""
        t = Table([[title]], colWidths=[PAGE_W])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), RED),
            ("TEXTCOLOR",     (0, 0), (-1, -1), white),
            ("FONTNAME",      (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 10),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ]))
        return t

    def data_table(rows: list) -> Table:
        """
        Tableau 2 colonnes.
        La première ligne est le header de section (fond sable, span, bold).
        Les lignes suivantes alternent label (col 0 bold) / valeur (col 1).
        """
        val_style = ParagraphStyle(
            "val", fontSize=9, textColor=CHARCOAL,
            fontName="Helvetica", leading=13, wordWrap="CJK",
        )
        wrapped = []
        for i, row in enumerate(rows):
            if i == 0:
                wrapped.append(row)
            else:
                label = row[0]
                val   = row[1]
                wrapped.append([label, Paragraph(str(val), val_style) if val else ""])
        t = Table(wrapped, colWidths=[COL1, COL2])
        n = len(rows)
        style = [
            # Global
            ("FONTNAME",      (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE",      (0, 0), (-1, -1), 9),
            ("TEXTCOLOR",     (0, 0), (-1, -1), CHARCOAL),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            ("GRID",          (0, 0), (-1, -1), 0.3, TAUPE),
            # Header row (ligne 0)
            ("BACKGROUND",    (0, 0), (-1, 0), SAND),
            ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
            ("SPAN",          (0, 0), (-1, 0)),
            # Colonne labels (col 0, lignes 1+)
            ("FONTNAME",      (0, 1), (0, -1), "Helvetica-Bold"),
        ]
        t.setStyle(TableStyle(style))
        return t

    story = []

    # ── En-tête ──────────────────────────────────────────────────────────────
    # "KIPAR" en charcoal + "." en rouge
    title_style = ParagraphStyle(
        "title",
        fontSize=24,
        fontName="Helvetica-Bold",
        spaceAfter=3 * mm,
        leading=28,
    )
    story.append(Paragraph(
        '<font color="#3D3D3D">KIPAR</font><font color="#DC0029">.</font>',
        title_style,
    ))

    subtitle_style = ParagraphStyle(
        "subtitle",
        fontSize=11,
        textColor=TAUPE,
        fontName="Helvetica",
        spaceAfter=1 * mm,
    )
    # Numero de dossier
    story.append(Paragraph(
        f"Dossier de litige \u2014 Référence : {str(dispute.get('id', '')).upper()}",
        subtitle_style,
    ))
    # Date de generation + support
    meta_style = ParagraphStyle("meta", fontSize=8, textColor=TAUPE, fontName="Helvetica", spaceAfter=3 * mm)
    story.append(Paragraph(
        f"Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')} \u2022 support@kipar.app",
        meta_style,
    ))
    # Badge statut
    status_val = dispute.get("status", "")
    badge_color = GREEN if "resolved" in status_val else (TAUPE if status_val == "cancelled" else AMBER)
    badge_label = STATUS_LABELS.get(status_val, status_val).upper()
    badge_table = Table([[badge_label]], colWidths=[40 * mm])
    badge_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), badge_color),
        ("TEXTCOLOR",     (0, 0), (-1, -1), white),
        ("FONTNAME",      (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    story.append(badge_table)
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=RED, spaceAfter=6 * mm))

    # ── Informations générales ────────────────────────────────────────────────
    story.append(section_header("INFORMATIONS GENERALES"))
    story.append(data_table([
        ["INFORMATIONS GENERALES", ""],
        ["Statut",               STATUS_LABELS.get(dispute.get("status", ""), dispute.get("status", "N/A"))],
        ["Type d'incident",      INCIDENT_LABELS.get(dispute.get("incident_type", ""), dispute.get("incident_type", "N/A"))],
        ["Moment de l'incident", STAGE_LABELS.get(dispute.get("incident_stage", ""), dispute.get("incident_stage", "N/A"))],
        ["Declare par",          ROLE_LABELS.get(dispute.get("initiated_by_role", ""), dispute.get("initiated_by_role", "N/A"))],
        ["Date d'ouverture",     fmt_date(dispute.get("created_at"))],
        ["Date de resolution",   fmt_date(dispute.get("resolved_at"))],
        ["Assurance souscrite",  "Oui" if dispute.get("has_insurance") else "Non"],
    ]))
    story.append(Spacer(1, 4 * mm))

    # ── Parties ───────────────────────────────────────────────────────────────
    story.append(section_header("PARTIES"))
    for role in ["sender", "carrier", "receiver"]:
        party = dispute.get(role)
        if party:
            rows = party_rows(party, role)
            story.append(data_table(rows))
            story.append(Spacer(1, 2 * mm))
    story.append(Spacer(1, 2 * mm))

    # ── Booking ───────────────────────────────────────────────────────────────
    booking = dispute.get("booking")
    if booking:
        story.append(section_header("BOOKING"))
        booking_rows = [
            ["BOOKING", ""],
            ["Montant",        f"{booking.get('amount', 'N/A')} {booking.get('currency', 'EUR')}"],
            ["Statut booking", booking.get("status", "N/A")],
        ]
        trip = dispute.get("trip")
        if trip:
            booking_rows += [
                ["Corridor",        f"{trip.get('origin_city', '')} ({trip.get('origin', '')}) \u2192 {trip.get('destination_city', '')} ({trip.get('destination', '')})"],
                ["Date de depart",  trip.get("departure_date", "N/A")],
                ["Compagnie",       trip.get("airline") or "N/A"],
                ["Numero de vol",   trip.get("flight_number") or "N/A"],
            ]
        story.append(data_table(booking_rows))
        story.append(Spacer(1, 4 * mm))

    # ── Colis ─────────────────────────────────────────────────────────────────
    pkg = dispute.get("package")
    if pkg:
        story.append(section_header("COLIS"))
        declared = pkg.get("declared_value")
        declared_str = f"{declared} EUR" if declared else "Non renseignee"
        pkg_rows = [
            ["COLIS", ""],
            ["Description",      pkg.get("content_description", "N/A")],
            ["Valeur declaree",  declared_str],
            ["Poids",            f"{pkg.get('weight_kg', 'N/A')} kg"],
            ["Photos colis",     f"{len(pkg.get('photo_urls', []))} photo(s) disponible(s) en ligne"],
        ]
        story.append(data_table(pkg_rows))
        story.append(Spacer(1, 4 * mm))

    # ── Motif et preuves ──────────────────────────────────────────────────────
    story.append(section_header("MOTIF ET PREUVES"))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"<b>Motif declare :</b> {dispute.get('reason', 'N/A')}",
        body_style,
    ))
    evidence = dispute.get("evidence_urls") or []
    if evidence:
        story.append(Paragraph(
            f"<b>Photos preuves declarant :</b> {len(evidence)} photo(s)",
            body_style,
        ))
        for url in evidence:
            story.append(Paragraph(f"  - {url}", body_style))
    if dispute.get("respondent_comment"):
        story.append(Paragraph(
            f"<b>Reponse partie adverse :</b> {dispute['respondent_comment']}",
            body_style,
        ))
    resp_ev = dispute.get("respondent_evidence_urls") or []
    if resp_ev:
        story.append(Paragraph(
            f"<b>Photos preuves partie adverse :</b> {len(resp_ev)} photo(s)",
            body_style,
        ))
    story.append(Spacer(1, 4 * mm))

    # ── Timeline ──────────────────────────────────────────────────────────────
    story.append(section_header("TIMELINE"))
    timeline = dispute.get("timeline", {})
    story.append(data_table([
        ["TIMELINE", ""],
        ["Litige ouvert",       fmt_date(timeline.get("created_at"))],
        ["Pickup failed",       fmt_date(timeline.get("pickup_failed_at"))],
        ["Delivery failed",     fmt_date(timeline.get("delivery_failed_at"))],
        ["Echeance reponse",    fmt_date(timeline.get("incident_response_deadline"))],
        ["Resolu le",           fmt_date(timeline.get("resolved_at"))],
    ]))
    story.append(Spacer(1, 4 * mm))

    # ── Résolution admin ──────────────────────────────────────────────────────
    if dispute.get("resolution"):
        story.append(section_header("RESOLUTION ADMIN"))
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(dispute["resolution"], body_style))
        story.append(Spacer(1, 4 * mm))

    # ── Assurance ─────────────────────────────────────────────────────────────
    if dispute.get("has_insurance"):
        story.append(section_header("ASSURANCE"))
        ins = dispute.get("insurance_detail") or {}
        story.append(data_table([
            ["ASSURANCE", ""],
            ["Souscrite le",           fmt_date(ins.get("subscribed_at"))],
            ["Statut contrat",         ins.get("status", "N/A")],
            ["Valeur declaree",        f"{ins.get('declared_value', dispute.get('package', {}).get('declared_value', 'N/A'))} EUR"],
            ["Taux applique",          f"{(ins.get('rate') or 0) * 100:.1f}%"],
            ["Prime payee",            f"{ins.get('premium_amount', 'N/A')} EUR"],
            ["Couverture max",         f"{ins.get('coverage_amount', 'N/A')} EUR"],
            ["Dossier envoye assureur","Oui" if dispute.get("insurer_dossier_sent") else "Non"],
            ["Date envoi",             fmt_date(dispute.get("insurer_dossier_sent_at"))],
            ["Reference assureur",     dispute.get("insurer_reference") or "En attente"],
            ["Indemnisation versee",   f"{dispute.get('insurance_payout', 0):.2f} EUR"],
        ]))
        story.append(Spacer(1, 4 * mm))

    # ── Pied de page ──────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=TAUPE))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"Document genere par KIPAR. le {datetime.now().strftime('%d/%m/%Y a %H:%M')} | Confidentiel",
        footer_style,
    ))

    doc.build(story)
    return buffer.getvalue()