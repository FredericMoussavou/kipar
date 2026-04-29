from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.trip import Trip
from app.models.booking import Booking
from app.models.pir_report import PIRReport
from app.services.notification_service import send_email, send_push
from app.core.config import settings
from app.i18n.loader import t

router = APIRouter(prefix="/pir", tags=["pir"])


class PIRCreate(BaseModel):
    trip_id: uuid.UUID
    pir_document_url: str | None = None
    airline_reference: str | None = None


class PIRResponse(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    carrier_id: uuid.UUID
    pir_document_url: str | None
    airline_reference: str | None
    status: str
    reported_at: datetime
    deadline_at: datetime | None
    resolved_at: datetime | None
    found: bool
    resolution_note: str | None
    affected_booking_ids: list

    model_config = {"from_attributes": True}


class PIRUpdate(BaseModel):
    status: str  # searching / found / lost_confirmed
    pir_document_url: str | None = None
    resolution_note: str | None = None


@router.post("", response_model=PIRResponse, status_code=201)
async def report_lost_luggage(
    payload: PIRCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Le transporteur signale que son bagage a été perdu par la compagnie.
    Déclenche la procédure Convention de Montréal (J+21).
    Gèle tous les paiements escrow du trajet.
    """
    result = await db.execute(select(Trip).where(Trip.id == payload.trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail=t("errors.trip_not_found", lang))
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if trip.status != "in_transit":
        raise HTTPException(status_code=400, detail=t("errors.trip_not_in_transit", lang))

    # Vérifie qu'un PIR n'existe pas déjà
    result = await db.execute(
        select(PIRReport).where(PIRReport.trip_id == payload.trip_id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=t("errors.pir_already_reported", lang))

    # Récupère tous les bookings du trajet
    result = await db.execute(
        select(Booking).where(
            Booking.trip_id == payload.trip_id,
            Booking.status.in_(["paid", "in_transit", "accepted"])
        )
    )
    bookings = result.scalars().all()
    affected_ids = [str(b.id) for b in bookings]

    # Gèle tous les paiements — statut disputed
    for booking in bookings:
        booking.status = "disputed"

    # Crée le rapport PIR
    pir = PIRReport(
        trip_id=payload.trip_id,
        carrier_id=current_user.id,
        pir_document_url=payload.pir_document_url,
        airline_reference=payload.airline_reference,
        status="open",
        reported_at=datetime.now(timezone.utc),
        deadline_at=datetime.now(timezone.utc) + timedelta(days=21),
        affected_booking_ids=affected_ids,
    )
    db.add(pir)
    await db.flush()

    # Notifie le support Kipar
    await send_email(
        to=settings.SUPPORT_EMAIL,
        subject=f"KIPAR. — PIR Bagage perdu — Trajet #{str(payload.trip_id)[:8]}",
        html=f"""
        <h2>Bagage perdu signalé</h2>
        <p><b>Transporteur :</b> {current_user.email}</p>
        <p><b>Trajet :</b> {trip.origin_airport_code} → {trip.destination_airport_code}</p>
        <p><b>Vol :</b> {trip.flight_number or 'Non renseigné'}</p>
        <p><b>Référence PIR :</b> {payload.airline_reference or 'Non fournie'}</p>
        <p><b>Document PIR :</b> {payload.pir_document_url or 'Non fourni'}</p>
        <p><b>Colis affectés :</b> {len(affected_ids)}</p>
        <p><b>Deadline Convention de Montréal :</b> J+21 = {pir.deadline_at.strftime('%d/%m/%Y')}</p>
        <p><a href="{settings.FRONTEND_URL}/admin/pir/{pir.id}">Gérer ce PIR</a></p>
        """
    )

    # Notifie chaque expéditeur affecté
    for booking in bookings:
        result = await db.execute(select(User).where(User.id == booking.sender_id))
        sender = result.scalar_one_or_none()
        if sender:
            body = t("notifications.pir_opened", sender.language)
            if sender.fcm_token:
                await send_push(sender.fcm_token, "KIPAR.", body)
            await send_email(
                to=sender.email,
                subject="KIPAR. — Information importante sur votre colis",
                html=f"""
                <h2>Bagage signalé perdu par la compagnie aérienne</h2>
                <p>{body}</p>
                <p>La compagnie aérienne dispose de <b>21 jours</b> pour retrouver le bagage.</p>
                <p>Votre paiement est sécurisé — nous vous tiendrons informé(e) de l'avancement.</p>
                """
            )

    return pir


@router.get("/{pir_id}", response_model=PIRResponse)
async def get_pir(
    pir_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Consulte un rapport PIR."""
    result = await db.execute(select(PIRReport).where(PIRReport.id == pir_id))
    pir = result.scalar_one_or_none()
    if not pir:
        raise HTTPException(status_code=404, detail=t("errors.pir_not_found", lang))
    if pir.carrier_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    return pir


@router.patch("/{pir_id}", response_model=PIRResponse)
async def update_pir(
    pir_id: str,
    payload: PIRUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Met à jour le statut PIR.
    - 'found' : bagage retrouvé → procédure normale reprend
    - 'lost_confirmed' : perte confirmée → remboursements déclenchés
    """
    result = await db.execute(select(PIRReport).where(PIRReport.id == pir_id))
    pir = result.scalar_one_or_none()
    if not pir:
        raise HTTPException(status_code=404, detail=t("errors.pir_not_found", lang))

    # Seul le transporteur ou un admin peut mettre à jour
    if pir.carrier_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    pir.status = payload.status
    if payload.pir_document_url:
        pir.pir_document_url = payload.pir_document_url
    if payload.resolution_note:
        pir.resolution_note = payload.resolution_note

    # Récupère les bookings affectés
    affected_bookings = []
    for booking_id in pir.affected_booking_ids:
        result = await db.execute(select(Booking).where(Booking.id == booking_id))
        b = result.scalar_one_or_none()
        if b:
            affected_bookings.append(b)

    if payload.status == "found":
        # Bagage retrouvé — reprend la procédure normale
        pir.found = True
        pir.resolved_at = datetime.now(timezone.utc)
        for booking in affected_bookings:
            booking.status = "in_transit"

        # Notifie les expéditeurs
        for booking in affected_bookings:
            result = await db.execute(select(User).where(User.id == booking.sender_id))
            sender = result.scalar_one_or_none()
            if sender:
                body = t("notifications.pir_resolved_found", sender.language)
                if sender.fcm_token:
                    await send_push(sender.fcm_token, "KIPAR.", body)
                await send_email(
                    to=sender.email,
                    subject="KIPAR. — Votre bagage a été retrouvé",
                    html=f"<p>{body}</p>"
                )

    elif payload.status == "lost_confirmed":
        # Perte définitive — rembourse les expéditeurs assurés
        pir.found = False
        pir.resolved_at = datetime.now(timezone.utc)

        for booking in affected_bookings:
            booking.status = "refunded"
            # TODO : déclencher remboursement via Stripe/Flutterwave selon rail

            result = await db.execute(select(User).where(User.id == booking.sender_id))
            sender = result.scalar_one_or_none()
            if sender:
                body = t("notifications.pir_resolved_lost", sender.language)
                if sender.fcm_token:
                    await send_push(sender.fcm_token, "KIPAR.", body)
                await send_email(
                    to=sender.email,
                    subject="KIPAR. — Traitement de votre remboursement",
                    html=f"<p>{body}</p>"
                )

    return pir
