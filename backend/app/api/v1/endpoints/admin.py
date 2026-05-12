from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import timedelta
from app.core.config import settings
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.booking import Booking
from app.models.dispute import Dispute
from app.models.trip import Trip
from app.models.review import Review
from app.models.package_request import PackageRequest
from app.i18n.loader import t

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/disputes")
async def list_disputes(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    status: str | None = None,
):
    """Liste tous les litiges — admin uniquement."""
    query = select(Dispute)
    if status:
        query = query.where(Dispute.status == status)
    query = query.order_by(Dispute.created_at.desc())
    result = await db.execute(query)
    disputes = result.scalars().all()

    output = []
    for d in disputes:
        booking_result = await db.execute(select(Booking).where(Booking.id == d.booking_id))
        booking = booking_result.scalar_one_or_none()
        output.append({
            "id": str(d.id),
            "booking_id": str(d.booking_id),
            "status": d.status,
            "reason": d.reason,
            "resolution": d.resolution,
            "created_at": d.created_at.isoformat(),
            "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
            "booking_status": booking.status if booking else None,
            "amount": booking.amount if booking else None,
        })
    return output


@router.get("/disputes/{dispute_id}")
async def get_dispute(
    dispute_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Detail complet d'un litige - admin uniquement.
    Retourne : declarant, partie adverse, booking, colis, preuves, timeline.
    """
    from app.models.package import Package
    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    booking_result = await db.execute(select(Booking).where(Booking.id == dispute.booking_id))
    booking = booking_result.scalar_one_or_none()

    # Parties
    initiator_result = await db.execute(select(User).where(User.id == dispute.initiated_by))
    initiator = initiator_result.scalar_one_or_none()
    sender, carrier, receiver, trip, pkg = None, None, None, None, None
    if booking:
        sender_r = await db.execute(select(User).where(User.id == booking.sender_id))
        sender = sender_r.scalar_one_or_none()
        trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
        trip = trip_r.scalar_one_or_none()
        if trip:
            carrier_r = await db.execute(select(User).where(User.id == trip.carrier_id))
            carrier = carrier_r.scalar_one_or_none()
        if booking.receiver_id:
            recv_r = await db.execute(select(User).where(User.id == booking.receiver_id))
            receiver = recv_r.scalar_one_or_none()
        pkg_r = await db.execute(select(Package).where(Package.id == booking.package_id))
        pkg = pkg_r.scalar_one_or_none()
        ins = None
        if booking.insurance_subscribed:
            from app.models.insurance import Insurance
            ins_r = await db.execute(select(Insurance).where(Insurance.booking_id == booking.id))
            ins = ins_r.scalar_one_or_none()

    def user_info(u):
        if not u: return None
        return {
            "id": str(u.id), "full_name": u.full_name,
            "email": u.email, "phone": u.phone,
            "address": u.address, "trust_score": u.trust_score,
        }

    return {
        # Litige
        "id": str(dispute.id),
        "status": dispute.status,
        "incident_type": dispute.incident_type,
        "incident_stage": dispute.incident_stage,
        "reason": dispute.reason,
        "evidence_urls": dispute.evidence_urls,
        "admin_notes": dispute.admin_notes,
        "resolution": dispute.resolution,
        # Declarant
        "initiated_by_role": dispute.initiated_by_role,
        "initiator": user_info(initiator),
        # Partie adverse
        "respondent_comment": dispute.respondent_comment,
        "respondent_evidence_urls": dispute.respondent_evidence_urls,
        # Assurance
        "has_insurance": dispute.has_insurance,
        "insurance_payout": dispute.insurance_payout,
        "insurer_dossier_sent": dispute.insurer_dossier_sent,
        "insurer_dossier_sent_at": dispute.insurer_dossier_sent_at.isoformat() if dispute.insurer_dossier_sent_at else None,
        "insurer_reference": dispute.insurer_reference,
        "insurance_detail": {
            "rate": ins.rate,
            "premium_amount": ins.premium_amount,
            "coverage_amount": ins.coverage_amount,
            "subscribed_at": ins.subscribed_at.isoformat() if ins.subscribed_at else None,
            "status": ins.status,
        } if ins else None,
        # Booking
        "booking": {
            "id": str(booking.id) if booking else None,
            "status": booking.status if booking else None,
            "amount": booking.amount if booking else None,
            "currency": booking.currency if booking else None,
            "weight_unit": booking.weight_unit if booking else None,
            "insurance_subscribed": booking.insurance_subscribed if booking else None,
            "cancellation_reason": booking.cancellation_reason if booking else None,
        } if booking else None,
        # Colis
        "package": {
            "content_description": pkg.content_description if pkg else None,
            "declared_value": dispute.declared_value or (pkg.declared_value if pkg else None),
            "weight_kg": pkg.weight_kg if pkg else None,
            "photo_urls": pkg.photo_urls if pkg else [],
            "ai_prohibited_flag": pkg.ai_prohibited_flag if pkg else None,
        } if pkg else None,
        # Corridor
        "trip": {
            "origin": trip.origin_airport_code if trip else None,
            "destination": trip.destination_airport_code if trip else None,
            "departure_date": str(trip.departure_date) if trip else None,
            "flight_number": trip.flight_number if trip else None,
        } if trip else None,
        # Parties
        "sender": user_info(sender),
        "carrier": user_info(carrier),
        "receiver": user_info(receiver),
        # Timeline
        "timeline": {
            "created_at": dispute.created_at.isoformat(),
            "pickup_failed_at": booking.pickup_failed_at.isoformat() if booking and booking.pickup_failed_at else None,
            "delivery_failed_at": booking.delivery_failed_at.isoformat() if booking and booking.delivery_failed_at else None,
            "incident_response_deadline": booking.incident_response_deadline.isoformat() if booking and booking.incident_response_deadline else None,
            "resolved_at": dispute.resolved_at.isoformat() if dispute.resolved_at else None,
        },
        # Lien messagerie
        "conversation_id": str(dispute.conversation_id) if dispute.conversation_id else None,
    }



@router.patch("/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    lang: str = Depends(get_lang),
):
    """Resout un litige — admin uniquement.
    decision: resolved_sender | resolved_carrier
    resolution: texte explicatif obligatoire
    """
    decision = payload.get("decision", "").strip()
    resolution = payload.get("resolution", "").strip()
    if decision not in ("resolved_sender", "resolved_carrier", "split"):
        raise HTTPException(status_code=400, detail="decision must be resolved_sender, resolved_carrier or split")
    if not resolution:
        raise HTTPException(status_code=400, detail=t("errors.reason_required", lang))

    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if dispute.status != "open":
        raise HTTPException(status_code=400, detail="Dispute already resolved")

    booking_result = await db.execute(select(Booking).where(Booking.id == dispute.booking_id))
    booking = booking_result.scalar_one_or_none()

    dispute.status = decision
    dispute.resolution = resolution
    dispute.resolved_by = admin.id
    dispute.resolved_at = datetime.now(timezone.utc)

    if booking:
        if decision == "resolved_sender":
            # Expediteur gagne -> transporteur fautif -> remboursement expediteur
            booking.status = "cancelled"
            booking.cancellation_reason = "dispute_resolved_sender"
            # Frais litige 10EUR a charge du transporteur
            print(f"[DISPUTE] Frais litige {settings.DISPUTE_FEE}EUR factures au transporteur booking {booking.id}")
            # TODO Sprint 4 : prelevement reel Stripe/Flutterwave
        elif decision == "resolved_carrier":
            # Transporteur gagne -> service rendu, liberer escrow
            booking.status = "delivered"
            booking.delivery_confirmed_at = datetime.now(timezone.utc)
            # Frais litige 10EUR a charge de l'expediteur/recepteur fautif
            print(f"[DISPUTE] Frais litige {settings.DISPUTE_FEE}EUR factures a l'expediteur booking {booking.id}")
            # TODO Sprint 4 : prelevement reel Stripe/Flutterwave
            from app.workers.booking_tasks import release_payment_after_delivery
            release_payment_after_delivery.delay(str(booking.id))
        else:
            # Split -> torts partages, admin decide la repartition
            booking.status = "disputed_split"
            print(f"[DISPUTE] Split decision booking {booking.id} - repartition manuelle requise")

    # Notifier les parties
    from app.services.notif_db_service import create_notification
    if booking:
        await create_notification(
            db=db,
            user_id=booking.sender_id,
            type="dispute_resolved",
            title="Litige resolu",
            body=f"Decision admin : {decision}. {resolution}",
            link=f"/packages/{booking.id}",
        )

    await db.commit()
    return {
        "status": decision,
        "dispute_id": dispute_id,
        "dispute_fee": settings.DISPUTE_FEE,
    }


@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    is_admin: bool | None = None,
):
    """Liste tous les utilisateurs — admin uniquement."""
    query = select(User).where(User.deleted_at.is_(None))
    if is_admin is not None:
        query = query.where(User.is_admin == is_admin)
    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "kyc_status": u.kyc_status,
            "is_admin": u.is_admin,
            "trust_score": u.trust_score,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.patch("/users/{user_id}/toggle-admin")
async def toggle_admin(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Passe un utilisateur en admin ou retire le role — admin uniquement."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = not user.is_admin
    await db.commit()
    return {"user_id": user_id, "is_admin": user.is_admin}


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Statistiques globales — admin uniquement."""
    users_q = await db.execute(select(func.count(User.id)).where(User.deleted_at.is_(None)))
    bookings_q = await db.execute(select(func.count(Booking.id)))
    disputes_q = await db.execute(select(func.count(Dispute.id)).where(Dispute.status == "open"))
    kyc_pending_q = await db.execute(select(func.count(User.id)).where(User.kyc_status == "pending", User.deleted_at.is_(None)))
    trips_q = await db.execute(select(func.count(Trip.id)).where(Trip.deleted_at.is_(None)))
    revenue_q = await db.execute(select(func.sum(Booking.amount)).where(Booking.status == "delivered"))

    return {
        "total_users": users_q.scalar() or 0,
        "total_bookings": bookings_q.scalar() or 0,
        "open_disputes": disputes_q.scalar() or 0,
        "kyc_pending": kyc_pending_q.scalar() or 0,
        "total_trips": trips_q.scalar() or 0,
        "total_revenue": float(revenue_q.scalar() or 0),
    }


@router.get("/users/kyc-pending")
async def list_kyc_pending(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Liste les utilisateurs avec KYC en attente."""
    result = await db.execute(
        select(User).where(
            User.kyc_status == "pending",
            User.deleted_at.is_(None),
        ).order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "username": u.username,
            "kyc_status": u.kyc_status,
            "trust_score": u.trust_score,
            "created_at": u.created_at.isoformat(),
            "id_front": u.kyc_id_front,
            "id_back": u.kyc_id_back,
            "selfie": u.kyc_selfie,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/kyc")
async def update_kyc(
    user_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    lang: str = Depends(get_lang),
):
    """Approuve ou rejette le KYC d un utilisateur."""
    decision = payload.get("decision", "").strip()
    if decision not in ("verified", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be verified or rejected")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=t("errors.user_not_found", lang))

    user.kyc_status = decision
    if decision == "verified":
        user.trust_score = min(100.0, user.trust_score + 20.0)

    return {"user_id": user_id, "kyc_status": decision}


@router.patch("/bookings/{booking_id}/justify-cancellation")
async def justify_cancellation(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    lang: str = Depends(get_lang),
):
    """Force majeure - admin uniquement.
    Pose cancellation_justified=True sur un booking annule.
    Declenche remboursement 100% + trust neutre + 0EUR Kipar (sauf forfait dossier deja preleve).
    """
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status not in ("cancelled_by_sender", "cancelled_by_carrier", "cancelled"):
        raise HTTPException(status_code=400, detail="Booking must be cancelled to justify")

    booking.cancellation_justified = True
    await db.commit()

    from app.services.notif_db_service import create_notification
    await create_notification(
        db=db,
        user_id=booking.sender_id,
        type="cancellation_justified",
        title="Annulation justifiee",
        body="Votre annulation a ete reconnue comme force majeure. Le remboursement integral va etre traite.",
        link=f"/packages/{booking.id}",
    )
    await db.commit()
    return {"booking_id": booking_id, "cancellation_justified": True}


@router.patch("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    lang: str = Depends(get_lang),
):
    """Bannit ou débannit un utilisateur."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=t("errors.user_not_found", lang))
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Cannot ban an admin")

    user.is_active = not user.is_active
    return {"user_id": user_id, "is_active": user.is_active}


@router.get("/finance")
async def get_finance(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    period: str = "month",  # day / week / month / year
):
    """Donnees financieres agregees — admin uniquement."""
    now = datetime.now(timezone.utc)

    if period == "day":
        delta = timedelta(days=1)
        trunc = "hour"
        fmt = "%H:00"
        points = 24
    elif period == "week":
        delta = timedelta(days=7)
        trunc = "day"
        fmt = "%a"
        points = 7
    elif period == "year":
        delta = timedelta(days=365)
        trunc = "month"
        fmt = "%b"
        points = 12
    else:  # month
        delta = timedelta(days=30)
        trunc = "day"
        fmt = "%d"
        points = 30

    since = now - delta

    # Bookings dans la periode
    result = await db.execute(
        select(Booking).where(
            Booking.created_at >= since,
        )
    )
    bookings = result.scalars().all()

    # Stats globales
    delivered = [b for b in bookings if b.status == "delivered"]
    in_progress = [b for b in bookings if b.status in ("paid", "in_transit", "accepted")]
    blocked = [b for b in bookings if b.status in ("disputed", "refunded")]

    total_revenue = sum(b.amount for b in delivered)
    total_fees = total_revenue * (settings.SERVICE_FEE_SENDER_PERCENT + settings.SERVICE_FEE_CARRIER_PERCENT)
    total_in_progress = sum(b.amount for b in in_progress)
    total_blocked = sum(b.amount for b in blocked)

    # Serie temporelle — grouper par periode
    from collections import defaultdict
    series: dict = defaultdict(lambda: {"revenue": 0.0, "fees": 0.0, "count": 0})

    for b in delivered:
        if trunc == "hour":
            key = b.created_at.strftime("%H:00")
        elif trunc == "day":
            key = b.created_at.strftime("%d/%m")
        elif trunc == "month":
            key = b.created_at.strftime("%b %Y")
        else:
            key = b.created_at.strftime("%d/%m")
        series[key]["revenue"] += b.amount
        series[key]["fees"] += b.amount * (settings.SERVICE_FEE_SENDER_PERCENT + settings.SERVICE_FEE_CARRIER_PERCENT)
        series[key]["count"] += 1

    chart_data = [
        {"label": k, "revenue": round(v["revenue"], 2), "fees": round(v["fees"], 2), "count": v["count"]}
        for k, v in sorted(series.items())
    ]

    return {
        "period": period,
        "since": since.isoformat(),
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_fees": round(total_fees, 2),
            "total_in_progress": round(total_in_progress, 2),
            "total_blocked": round(total_blocked, 2),
            "delivered_count": len(delivered),
            "in_progress_count": len(in_progress),
            "blocked_count": len(blocked),
            "service_fee_sender_percent": settings.SERVICE_FEE_SENDER_PERCENT * 100,
            "service_fee_carrier_percent": settings.SERVICE_FEE_CARRIER_PERCENT * 100,
            "booking_flat_fee": settings.BOOKING_FLAT_FEE,
            # Revenus forfaits dossier (1.50EUR x bookings confirmes)
            "flat_fee_revenue": round(len([b for b in bookings if b.booking_fee_collected]) * settings.BOOKING_FLAT_FEE, 2),
            "flat_fee_count": len([b for b in bookings if b.booking_fee_collected]),
            # Incidents et litiges
            "cancelled_by_sender": len([b for b in bookings if b.status == "cancelled_by_sender"]),
            "cancelled_by_carrier": len([b for b in bookings if b.status == "cancelled_by_carrier"]),
            "disputed_count": len([b for b in bookings if b.status == "disputed"]),
            "pickup_failed_count": len([b for b in bookings if b.status == "pickup_failed"]),
            "delivery_failed_count": len([b for b in bookings if b.status == "delivery_failed"]),
            "justified_cancellations": len([b for b in bookings if b.cancellation_justified]),
        },
        "chart": chart_data,
    }




@router.patch("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    lang: str = Depends(get_lang),
):
    """Reactivation compte - admin uniquement."""
    from app.services.notif_db_service import create_notification
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=t("errors.user_not_found", lang))
    if user.is_active:
        raise HTTPException(status_code=400, detail="User is already active")
    user.is_active = True
    await db.commit()
    await create_notification(
        db=db,
        user_id=user.id,
        type="account_reactivated",
        title="Compte reactivé",
        body="Votre compte KIPAR a été reactivé. Vous pouvez de nouveau utiliser la plateforme.",
        link="/dashboard",
    )
    await db.commit()
    return {"user_id": user_id, "is_active": True, "message": "Account reactivated"}


@router.get("/users/{user_id}/bookings-summary")
async def get_user_bookings_summary(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Resume bookings utilisateur - aide a la decision de reactivation."""
    from app.models.trip import Trip
    sender_r = await db.execute(select(Booking).where(Booking.sender_id == user_id))
    sender_bookings = sender_r.scalars().all()
    carrier_r = await db.execute(
        select(Booking).join(Trip, Trip.id == Booking.trip_id).where(Trip.carrier_id == user_id)
    )
    carrier_bookings = carrier_r.scalars().all()
    return {
        "user_id": user_id,
        "as_sender": {
            "total": len(sender_bookings),
            "delivered": len([b for b in sender_bookings if b.status == "delivered"]),
            "cancelled": len([b for b in sender_bookings if b.status == "cancelled_by_sender"]),
            "disputed": len([b for b in sender_bookings if b.status == "disputed"]),
        },
        "as_carrier": {
            "total": len(carrier_bookings),
            "delivered": len([b for b in carrier_bookings if b.status == "delivered"]),
            "cancelled": len([b for b in carrier_bookings if b.status == "cancelled_by_carrier"]),
            "disputed": len([b for b in carrier_bookings if b.status == "disputed"]),
        },
    }


@router.get("/disputes/{dispute_id}/export-pdf")
async def export_dispute_pdf(
    dispute_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Genere et retourne le dossier litige en PDF - admin uniquement."""
    from fastapi.responses import Response
    from app.services.dispute_pdf_service import generate_dispute_pdf
    from app.models.package import Package
    from app.models.insurance import Insurance

    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    # Recuperer toutes les donnees via le meme endpoint get_dispute
    booking_result = await db.execute(select(Booking).where(Booking.id == dispute.booking_id))
    booking = booking_result.scalar_one_or_none()
    initiator_result = await db.execute(select(User).where(User.id == dispute.initiated_by))
    initiator = initiator_result.scalar_one_or_none()
    sender, carrier, receiver, trip, pkg = None, None, None, None, None
    ins = None
    if booking:
        sender_r = await db.execute(select(User).where(User.id == booking.sender_id))
        sender = sender_r.scalar_one_or_none()
        trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
        trip = trip_r.scalar_one_or_none()
        if trip:
            carrier_r = await db.execute(select(User).where(User.id == trip.carrier_id))
            carrier = carrier_r.scalar_one_or_none()
        if booking.receiver_id:
            recv_r = await db.execute(select(User).where(User.id == booking.receiver_id))
            receiver = recv_r.scalar_one_or_none()
        pkg_r = await db.execute(select(Package).where(Package.id == booking.package_id))
        pkg = pkg_r.scalar_one_or_none()
        if booking.insurance_subscribed:
            ins_r = await db.execute(select(Insurance).where(Insurance.booking_id == booking.id))
            ins = ins_r.scalar_one_or_none()

    def u(user): return {
        "id": str(user.id), "full_name": user.full_name,
        "email": user.email, "phone": user.phone,
        "address": user.address, "trust_score": user.trust_score,
    } if user else None

    dispute_data = {
        "id": str(dispute.id),
        "status": dispute.status,
        "incident_type": dispute.incident_type,
        "incident_stage": dispute.incident_stage,
        "initiated_by_role": dispute.initiated_by_role,
        "reason": dispute.reason,
        "evidence_urls": dispute.evidence_urls or [],
        "respondent_comment": dispute.respondent_comment,
        "respondent_evidence_urls": dispute.respondent_evidence_urls or [],
        "has_insurance": dispute.has_insurance,
        "insurance_payout": dispute.insurance_payout,
        "insurer_dossier_sent": dispute.insurer_dossier_sent,
        "insurer_dossier_sent_at": dispute.insurer_dossier_sent_at.isoformat() if dispute.insurer_dossier_sent_at else None,
        "insurer_reference": dispute.insurer_reference,
        "resolution": dispute.resolution,
        "created_at": dispute.created_at.isoformat(),
        "resolved_at": dispute.resolved_at.isoformat() if dispute.resolved_at else None,
        "initiator": u(initiator),
        "sender": u(sender),
        "carrier": u(carrier),
        "receiver": u(receiver),
        "booking": {
            "amount": booking.amount, "currency": booking.currency,
            "status": booking.status,
        } if booking else None,
        "package": {
            "content_description": pkg.content_description,
            "declared_value": pkg.declared_value,
            "weight_kg": pkg.weight_kg,
            "photo_urls": pkg.photo_urls or [],
        } if pkg else None,
        "trip": {
            "origin": trip.origin_airport_code,
            "origin_city": trip.origin_city,
            "destination": trip.destination_airport_code,
            "destination_city": trip.destination_city,
            "departure_date": str(trip.departure_date),
            "flight_number": trip.flight_number,
            "airline": trip.airline,
        } if trip else None,
        "timeline": {
            "created_at": dispute.created_at.isoformat(),
            "pickup_failed_at": booking.pickup_failed_at.isoformat() if booking and booking.pickup_failed_at else None,
            "delivery_failed_at": booking.delivery_failed_at.isoformat() if booking and booking.delivery_failed_at else None,
            "incident_response_deadline": booking.incident_response_deadline.isoformat() if booking and booking.incident_response_deadline else None,
            "resolved_at": dispute.resolved_at.isoformat() if dispute.resolved_at else None,
        },
    }

    pdf_bytes = generate_dispute_pdf(dispute_data)
    filename = f"kipar_litige_{str(dispute.id)[:8].upper()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
