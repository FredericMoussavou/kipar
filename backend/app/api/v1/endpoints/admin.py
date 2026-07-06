from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
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
from app.models.platform_review import PlatformReview
from app.models.package_request import PackageRequest
from app.models.package import Package
from app.i18n.loader import t
from pydantic import BaseModel
from app.services.kyc_promotion_service import promote_pending_kyc_bookings

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
            # C3d refund dispute resolved_sender (forfait retenu)
            from app.services.stripe_service import settle_cancellation_refund
            _flat9 = settings.URGENT_FEE_KIPAR if booking.is_urgent else (booking.booking_flat_fee_amount or settings.BOOKING_FLAT_FEE)
            _refund9 = round(max(0.0, booking.amount - _flat9), 2)
            if booking.escrow_ref and booking.payment_rail == "stripe" and not booking.escrow_ref.startswith("pi_simulated") and settings.STRIPE_SECRET_KEY:
                try:
                    await settle_cancellation_refund(booking.escrow_ref, _refund9, 0.0, None, str(booking.id))
                except Exception as e:
                    import logging
                    logging.getLogger("kipar").error(f"[DISPUTE_SENDER] Refund booking {booking.id}: {e}")
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
            import logging
            logging.getLogger("kipar").info(
                "[DISPUTE] Split decision booking %s - repartition manuelle requise (Sprint 4)",
                booking.id
            )

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
            "is_active": u.is_active,
            "trust_score": u.trust_score,
            "created_at": u.created_at.isoformat(),
            # Prepare pour future fonctionnalite recompenses clients actifs
            "total_bookings_as_sender": 0,
            "total_bookings_as_carrier": 0,
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
    period: str = "month",
):
    """Statistiques globales avec filtre periode — admin uniquement."""
    now = datetime.now(timezone.utc)
    if period == "day":
        since = now - timedelta(days=1)
    elif period == "week":
        since = now - timedelta(days=7)
    elif period == "year":
        since = now - timedelta(days=365)
    else:
        since = now - timedelta(days=30)

    # Totaux globaux
    users_q = await db.execute(select(func.count(User.id)).where(User.deleted_at.is_(None), User.is_active.is_(True)))
    users_banned_q = await db.execute(select(func.count(User.id)).where(User.is_active.is_(False), User.deleted_at.is_(None)))
    users_deleted_q = await db.execute(select(func.count(User.id)).where(User.deleted_at.isnot(None)))
    disputes_q = await db.execute(select(func.count(Dispute.id)).where(Dispute.status == "open"))
    kyc_pending_q = await db.execute(select(func.count(User.id)).where(User.kyc_status == "pending", User.deleted_at.is_(None)))
    trips_q = await db.execute(select(func.count(Trip.id)).where(Trip.deleted_at.is_(None)))

    # Nouveaux KYC approuves sur la periode (approximation via updated_at)
    new_kyc_q = await db.execute(
        select(func.count(User.id)).where(
            User.kyc_status == "approved",
            User.updated_at >= since,
            User.deleted_at.is_(None),
        )
    )

    # Bookings sur la periode
    bookings_result = await db.execute(select(Booking).where(Booking.created_at >= since))
    bookings_period = bookings_result.scalars().all()

    bookings_actifs = [b for b in bookings_period if b.status in ("paid", "accepted", "in_transit")]
    bookings_livres = [b for b in bookings_period if b.status == "delivered"]
    bookings_litige = [b for b in bookings_period if b.status in ("disputed", "in_review")]
    bookings_validation = [b for b in bookings_period if b.status == "pending_admin_validation"]
    bookings_annules = [b for b in bookings_period if b.status in ("cancelled", "cancelled_by_sender", "cancelled_by_carrier", "refused")]

    return {
        "period": period,
        "since": since.isoformat(),
        # Utilisateurs
        "total_users": users_q.scalar() or 0,
        "users_banned": users_banned_q.scalar() or 0,
        "users_deleted": users_deleted_q.scalar() or 0,
        "new_kyc_approved": new_kyc_q.scalar() or 0,
        # Trajets
        "total_trips": trips_q.scalar() or 0,
        # Alertes (globales, hors periode)
        "open_disputes": disputes_q.scalar() or 0,
        "kyc_pending": kyc_pending_q.scalar() or 0,
        # Bookings periode
        "bookings_actifs": len(bookings_actifs),
        "bookings_livres": len(bookings_livres),
        "bookings_litige": len(bookings_litige),
        "bookings_validation": len(bookings_validation),
        "bookings_annules": len(bookings_annules),
        "total_bookings_period": len(bookings_period),
        # Legacy (compatibilite dashboard stats cards)
        "total_bookings": len(bookings_period),
        "total_revenue": float(sum(b.amount for b in bookings_livres)),
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
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be approved or rejected")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=t("errors.user_not_found", lang))

    user.kyc_status = decision
    if decision == "approved":
        await promote_pending_kyc_bookings(user, db)
    await db.commit()
    if decision == "approved":
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

    from datetime import datetime, timezone
    if user.is_banned:
        user.is_banned = False
        user.banned_at = None
        user.is_active = True
    else:
        user.is_banned = True
        user.banned_at = datetime.now(timezone.utc)
        user.is_active = False
    await db.commit()
    return {"user_id": user_id, "is_banned": user.is_banned, "is_active": user.is_active}


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

    # ── Revenue breakdown ──────────────────────────────────────────────────
    commissions_sender = sum(b.amount * settings.SERVICE_FEE_SENDER_PERCENT for b in delivered)
    commissions_carrier = sum(b.amount * settings.SERVICE_FEE_CARRIER_PERCENT for b in delivered)
    # Frais dossier : urgent -> part Kipar = URGENT_FEE_KIPAR, normal -> booking_flat_fee_amount
    flat_fees = sum(
        settings.URGENT_FEE_KIPAR if b.is_urgent else b.booking_flat_fee_amount
        for b in bookings if b.booking_fee_collected
    )

    # Frais annulation transporteur non justifiee
    carrier_cancels = [b for b in bookings if b.status == "cancelled_by_carrier" and not b.cancellation_justified]
    cancel_fees = sum(max(b.amount * settings.CARRIER_CANCEL_FEE_PERCENT, settings.CARRIER_CANCEL_FEE_MIN) for b in carrier_cancels)

    # Disputes resolues dans la periode — frais a charge du fautif
    disputes_result = await db.execute(
        select(Dispute).where(
            Dispute.created_at >= since,
            Dispute.status.in_(["resolved_sender", "resolved_carrier", "resolved_split"])
        )
    )
    disputes_resolved = disputes_result.scalars().all()
    dispute_fees = len(disputes_resolved) * settings.DISPUTE_FEE

    total_kipar_revenue = round(commissions_sender + commissions_carrier + flat_fees + cancel_fees + dispute_fees, 2)

    # ── Escrow ──────────────────────────────────────────────────────────────
    escrow_active = [b for b in bookings if b.status in ("paid", "in_transit", "accepted")]
    escrow_held = sum(b.amount for b in escrow_active)

    cancelled_all = [b for b in bookings if b.status in ("cancelled", "cancelled_by_sender", "cancelled_by_carrier", "refunded")]
    refunded_full = []
    refunded_partial = []
    no_refund = []
    for b in cancelled_all:
        if b.paid_at is None:
            continue
        trip_result = await db.execute(select(Trip).where(Trip.id == b.trip_id))
        trip = trip_result.scalar_one_or_none()
        if trip is None:
            continue
        hours_before = (trip.departure_date - b.paid_at).total_seconds() / 3600 if trip.departure_date > b.paid_at else 0
        if hours_before > settings.LATE_CANCEL_HOURS:
            refunded_full.append(b)
        elif hours_before > 0:
            refunded_partial.append(b)
        else:
            no_refund.append(b)

    # ── Assurance transit ───────────────────────────────────────────────────
    insured = [b for b in bookings if b.insurance_subscribed and b.insurance_amount > 0]
    insurance_collected = round(sum(b.insurance_amount for b in insured), 2)

    # ── Historique transactions ─────────────────────────────────────────────
    transactions = []
    for b in sorted(bookings, key=lambda x: x.created_at, reverse=True):
        trip_r = await db.execute(select(Trip).where(Trip.id == b.trip_id))
        trip = trip_r.scalar_one_or_none()
        sender_r = await db.execute(select(User).where(User.id == b.sender_id))
        sender = sender_r.scalar_one_or_none()
        carrier = None
        if trip:
            carrier_r = await db.execute(select(User).where(User.id == trip.carrier_id))
            carrier = carrier_r.scalar_one_or_none()
        pkg_r = await db.execute(select(Package).where(Package.id == b.package_id))
        pkg = pkg_r.scalar_one_or_none()
        commission = round(b.amount * (settings.SERVICE_FEE_SENDER_PERCENT + settings.SERVICE_FEE_CARRIER_PERCENT), 2) if b.status == "delivered" else 0.0
        transactions.append({
            "id": str(b.id),
            "date": b.created_at.isoformat(),
            "status": b.status,
            "amount": round(b.amount, 2),
            "commission": commission,
            "flat_fee": settings.BOOKING_FLAT_FEE if b.booking_fee_collected else 0.0,
            "insurance_amount": round(b.insurance_amount, 2),
            "payment_rail": b.payment_rail,
            "currency": b.currency,
            "origin": trip.origin_airport_code if trip else None,
            "destination": trip.destination_airport_code if trip else None,
            "departure_date": trip.departure_date.isoformat() if trip else None,
            "flight_number": trip.flight_number if trip else None,
            "sender": f"{sender.first_name} {sender.last_name}" if sender else None,
            "sender_email": sender.email if sender else None,
            "carrier": f"{carrier.first_name} {carrier.last_name}" if carrier else None,
            "carrier_email": carrier.email if carrier else None,
            "content_description": pkg.content_description if pkg else None,
            "weight_kg": pkg.weight_kg if pkg else None,
            "declared_value": pkg.declared_value if pkg else None,
        })

    # Revenus urgence (part Kipar uniquement)
    # Segmentation CA + marge Kipar (2 axes : mode kg/small, urgence)
    _rate = settings.SERVICE_FEE_SENDER_PERCENT + settings.SERVICE_FEE_CARRIER_PERCENT
    def _kg_margin(b):
        fee = (settings.URGENT_FEE_KIPAR if b.is_urgent else settings.BOOKING_FLAT_FEE) if b.booking_fee_collected else 0.0
        return b.amount * _rate + fee
    _d_kg = [b for b in delivered if b.package_mode != 'small']
    _d_small = [b for b in delivered if b.package_mode == 'small']
    _d_urgent = [b for b in delivered if b.is_urgent]
    _d_standard = [b for b in delivered if not b.is_urgent]
    segments = {
        'by_mode': {
            'kg': {'ca': round(sum(b.amount for b in _d_kg), 2), 'margin': round(sum(_kg_margin(b) for b in _d_kg), 2), 'count': len(_d_kg)},
            'small': {'ca': round(sum(b.amount for b in _d_small), 2), 'margin': round(len(_d_small) * settings.SMALL_PACKAGE_KIPAR_FEE, 2), 'count': len(_d_small)},
        },
        'by_urgency': {
            'urgent': {'ca': round(sum(b.amount for b in _d_urgent), 2), 'margin': round(sum((settings.SMALL_PACKAGE_KIPAR_FEE if b.package_mode == 'small' else _kg_margin(b)) for b in _d_urgent), 2), 'count': len(_d_urgent)},
            'standard': {'ca': round(sum(b.amount for b in _d_standard), 2), 'margin': round(sum((settings.SMALL_PACKAGE_KIPAR_FEE if b.package_mode == 'small' else _kg_margin(b)) for b in _d_standard), 2), 'count': len(_d_standard)},
        },
    }
    urgent_fees = sum(
        settings.URGENT_FEE_KIPAR for b in bookings
        if b.is_urgent and b.booking_fee_collected
    )
    normal_fees = sum(
        b.booking_flat_fee_amount for b in bookings
        if not b.is_urgent and b.booking_fee_collected
    )
    flat_fees_count_normal = len([b for b in bookings if b.booking_fee_collected and not b.is_urgent])
    flat_fees_count_urgent = len([b for b in bookings if b.booking_fee_collected and b.is_urgent])

    return {
        "period": period,
        "since": since.isoformat(),
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "segments": segments,
            "total_fees": round(total_fees, 2),
            "total_in_progress": round(total_in_progress, 2),
            "total_blocked": round(total_blocked, 2),
            "delivered_count": len(delivered),
            "in_progress_count": len(in_progress),
            "blocked_count": len(blocked),
            "service_fee_sender_percent": settings.SERVICE_FEE_SENDER_PERCENT * 100,
            "service_fee_carrier_percent": settings.SERVICE_FEE_CARRIER_PERCENT * 100,
            "booking_flat_fee": settings.BOOKING_FLAT_FEE,
            "flat_fee_revenue": round(flat_fees, 2),
            "flat_fee_count": len([b for b in bookings if b.booking_fee_collected]),
            "flat_fee_count_normal": flat_fees_count_normal,
            "flat_fee_count_urgent": flat_fees_count_urgent,
            "cancelled_by_sender": len([b for b in bookings if b.status == "cancelled_by_sender"]),
            "cancelled_by_carrier": len([b for b in bookings if b.status == "cancelled_by_carrier"]),
            "disputed_count": len([b for b in bookings if b.status == "disputed"]),
            "pickup_failed_count": len([b for b in bookings if b.status == "pickup_failed"]),
            "delivery_failed_count": len([b for b in bookings if b.status == "delivery_failed"]),
            "justified_cancellations": len([b for b in bookings if b.cancellation_justified]),
        },
        "revenue_breakdown": {
            # Ordinaires — acquis des la confirmation
            "flat_fees_normal": round(normal_fees, 2),
            "flat_fees_normal_count": flat_fees_count_normal,
            "flat_fees_urgent": round(urgent_fees, 2),
            "flat_fees_urgent_count": flat_fees_count_urgent,
            "commissions_sender": round(commissions_sender, 2),
            "commissions_carrier": round(commissions_carrier, 2),
            "total_ordinaire": round(normal_fees + urgent_fees + commissions_sender + commissions_carrier, 2),
            # Extraordinaires — evenements exceptionnels
            "dispute_fees": round(dispute_fees, 2),
            "cancel_fees": round(cancel_fees, 2),
            "total_extraordinaire": round(dispute_fees + cancel_fees, 2),
            # Total
            "flat_fees": round(flat_fees, 2),
            "total": total_kipar_revenue,
        },
        "escrow": {
            "held": round(escrow_held, 2),
            "count_active": len(escrow_active),
            "refunded_full_amount": round(sum(b.amount for b in refunded_full), 2),
            "refunded_full_count": len(refunded_full),
            "refunded_partial_amount": round(sum(b.amount * 0.5 for b in refunded_partial), 2),
            "refunded_partial_count": len(refunded_partial),
            "no_refund_amount": round(sum(b.amount for b in no_refund), 2),
            "no_refund_count": len(no_refund),
        },
        "insurance_transit": {
            "collected": insurance_collected,
            "count": len(insured),
        },
        "transactions": transactions,
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
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Banned user cannot be reactivated this way. Use unban endpoint.")
    user.is_active = True
    user.deleted_at = None
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


@router.get("/pending-validations")
async def list_pending_validations(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Liste les bookings en attente de validation admin (preuve alternative livraison)."""
    result = await db.execute(
        select(Booking).where(Booking.status == "pending_admin_validation")
    )
    bookings = result.scalars().all()
    out = []
    for b in bookings:
        trip_r = await db.execute(select(Trip).where(Trip.id == b.trip_id))
        trip = trip_r.scalar_one_or_none()
        sender_r = await db.execute(select(User).where(User.id == b.sender_id))
        sender = sender_r.scalar_one_or_none()
        out.append({
            "id": str(b.id),
            "created_at": b.created_at.isoformat(),
            "amount": b.amount,
            "currency": b.currency,
            "origin": trip.origin_airport_code if trip else None,
            "destination": trip.destination_airport_code if trip else None,
            "sender": f"{sender.first_name} {sender.last_name}" if sender else None,
            "sender_email": sender.email if sender else None,
            "proof_url": b.delivery_alternative_proof_url,
        })
    return out


@router.patch("/pending-validations/{booking_id}/approve")
async def approve_pending_validation(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Valide la preuve alternative -> delivered + liberation paiement."""
    from datetime import datetime, timezone
    from app.services.notif_db_service import create_notification

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "pending_admin_validation":
        raise HTTPException(status_code=400, detail="Statut invalide")

    booking.status = "delivered"
    booking.delivery_confirmed_at = datetime.now(timezone.utc)
    booking.delivery_confirmed_by = admin.id
    await db.commit()

    try:
        from app.workers.booking_tasks import release_payment_after_delivery
        release_payment_after_delivery.apply_async(args=[booking_id], countdown=0)
    except Exception:
        pass

    await create_notification(
        db=db, user_id=booking.sender_id,
        type="delivery_validated",
        title="Livraison validee par l'admin",
        body="La preuve de livraison a ete validee. Le paiement va etre libere.",
        link=f"/packages/{booking.id}",
    )
    await db.commit()
    return {"status": "delivered", "booking_id": booking_id}


@router.patch("/pending-validations/{booking_id}/reject")
async def reject_pending_validation(
    booking_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Rejette la preuve alternative -> litige ouvert automatiquement."""
    from datetime import datetime, timezone
    from app.models.dispute import Dispute
    from app.services.notif_db_service import create_notification

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "pending_admin_validation":
        raise HTTPException(status_code=400, detail="Statut invalide")

    reason = (payload.get("reason") or "Preuve insuffisante").strip()
    booking.status = "disputed"
    dispute = Dispute(
        booking_id=booking.id,
        initiated_by=admin.id,
        initiated_by_role="admin",
        reason=f"Preuve alternative rejetee par admin : {reason}",
        status="in_review",
    )
    db.add(dispute)
    await db.commit()

    await create_notification(
        db=db, user_id=booking.sender_id,
        type="dispute_opened",
        title="Litige ouvert",
        body=f"La preuve alternative a ete rejetee : {reason}. Un litige a ete ouvert.",
        link=f"/packages/{booking.id}",
    )
    await db.commit()
    return {"status": "disputed", "reason": reason}



# ===================== MODERATION AVIS PLATEFORME =====================

@router.get("/platform-reviews")
async def admin_list_platform_reviews(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Liste les avis plateforme (filtrable par statut) avec infos auteur."""
    query = select(PlatformReview, User).join(User, User.id == PlatformReview.user_id)
    if status:
        query = query.where(PlatformReview.status == status)
    query = query.order_by(desc(PlatformReview.created_at))
    rows = (await db.execute(query)).all()
    out = []
    for review, user in rows:
        out.append({
            "id": str(review.id),
            "rating": review.rating,
            "comment": review.comment,
            "status": review.status,
            "created_at": review.created_at.isoformat() if review.created_at else None,
            "updated_at": review.updated_at.isoformat() if review.updated_at else None,
            "user": {
                "id": str(user.id),
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
            },
        })
    return out


class PlatformReviewModerate(BaseModel):
    status: str  # approved | rejected | pending


@router.patch("/platform-reviews/{review_id}")
async def admin_moderate_platform_review(
    review_id: str,
    payload: PlatformReviewModerate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Approuve / rejette un avis plateforme."""
    if payload.status not in ("approved", "rejected", "pending"):
        raise HTTPException(status_code=400, detail="invalid_status")
    result = await db.execute(
        select(PlatformReview).where(PlatformReview.id == review_id)
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="review_not_found")
    review.status = payload.status
    await db.commit()
    await db.refresh(review)
    return {"id": str(review.id), "status": review.status}
