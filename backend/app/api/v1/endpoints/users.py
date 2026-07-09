from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, field_validator
from datetime import datetime, timezone
import re
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.core.security import verify_password
from app.models.user import User
from app.models.booking import Booking
from app.models.trip import Trip
from app.models.review import Review
from app.models.package_request import PackageRequest
from app.services.cloudinary_service import (
    generate_avatar_upload_signature,
    validate_avatar_url,
)
from app.i18n.loader import t, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE

router = APIRouter(prefix="/users", tags=["users"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class FCMTokenRequest(BaseModel):
    fcm_token: str


class LanguageRequest(BaseModel):
    language: str


class UpdateMeRequest(BaseModel):
    """Champs modifiables sur le profil perso. Tous optionnels."""
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    address: str | None = None
    phone: str | None = None
    is_carrier: bool | None = None
    weight_unit: str | None = None
    currency: str | None = None
    payment_method: str | None = None
    payment_country: str | None = None
    mobile_money_number: str | None = None
    payout_method: str | None = None
    bank_holder_name: str | None = None
    iban: str | None = None
    onboarding_completed: bool | None = None

    @field_validator("weight_unit")
    @classmethod
    def validate_weight_unit(cls, v: str | None) -> str | None:
        if v is None:
            return None
        allowed = {"kg", "g", "mg", "lb", "oz"}
        if v not in allowed:
            raise ValueError("Unite invalide. Valeurs acceptees : kg, g, mg, lb, oz")
        return v

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9_]{4,15}$", v):
            raise ValueError("Username invalide (4-15 caracteres, lettres minuscules, chiffres, underscore)")
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError("Le nom doit contenir entre 2 et 100 caracteres")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        v = v.strip().replace(" ", "").replace(".", "").replace("-", "")
        if not re.match(r"^(\+|00)?\d{8,15}$", v):
            raise ValueError("Format téléphone invalide")
        return v


class AvatarUrlRequest(BaseModel):
    avatar_url: str | None


class AvatarSignatureResponse(BaseModel):
    signature: str
    timestamp: int
    api_key: str
    cloud_name: str
    folder: str
    public_id: str
    upload_preset: str


class NotificationPreferencesRequest(BaseModel):
    notify_by_email: bool | None = None
    notify_by_push: bool | None = None
    notify_by_sms: bool | None = None


class DeleteAccountRequest(BaseModel):
    password: str


class PublicUserResponse(BaseModel):
    """Profil public — pas d'email, pas de phone, pas de données sensibles."""
    id: uuid.UUID
    first_name: str
    last_name: str
    avatar_url: str | None
    kyc_status: str
    trust_score: float
    is_carrier: bool
    created_at: datetime
    deliveries_as_sender: int
    deliveries_as_carrier: int
    trips_count: int
    reviews_count: int
    avg_rating: float | None
    is_premium: bool

    model_config = {"from_attributes": True}


# ─── Endpoints existants ────────────────────────────────────────────────────

@router.patch("/me/fcm-token")
async def update_fcm_token(
    payload: FCMTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    current_user.fcm_token = payload.fcm_token
    return {"message": t("success.fcm_token_updated", lang)}


@router.patch("/me/language")
async def update_language(
    payload: LanguageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    new_lang = payload.language if payload.language in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE
    current_user.language = new_lang
    await db.commit()
    return {"message": t("success.language_updated", lang), "language": new_lang}


@router.patch("/me")
async def update_me(
    payload: UpdateMeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Met à jour les champs modifiables du profil perso.
    Pour l'instant : uniquement le téléphone.

    L'email, le nom, le prénom, le KYC status, le trust score
    ne sont PAS modifiables via cet endpoint (sécurité / cohérence).
    """
    # Le champ phone explicite (None ou valeur) declenche la mise a jour
    if 'phone' in payload.model_fields_set:
        new_phone = payload.phone  # peut etre None apres validation

        # Vérifie qu'aucun autre user n'a déjà ce numéro (contrainte UNIQUE en DB)
        if new_phone and new_phone != current_user.phone:
            existing = await db.execute(
                select(User).where(
                    User.phone == new_phone,
                    User.id != current_user.id,
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=409,
                    detail=t("errors.phone_already_used", lang),
                )

        current_user.phone = new_phone

    if payload.first_name is not None:
        current_user.first_name = payload.first_name

    if payload.last_name is not None:
        current_user.last_name = payload.last_name

    if payload.address is not None:
        current_user.address = payload.address

    if payload.username is not None:
        new_username = payload.username
        # Cooldown 30 jours
        if current_user.username_updated_at is not None:
            cooldown_end = current_user.username_updated_at + timedelta(days=30)
            if datetime.now(timezone.utc) < cooldown_end:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code": "username_cooldown",
                        "next_change": cooldown_end.isoformat(),
                    },
                )
        # Unicite
        if new_username != current_user.username:
            existing = await db.execute(
                select(User).where(
                    User.username == new_username,
                    User.id != current_user.id,
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=409,
                    detail=t("errors.username_taken", lang),
                )
            current_user.username = new_username
            current_user.username_updated_at = datetime.now(timezone.utc)

    if payload.is_carrier is True:
        if current_user.kyc_status != "approved":
            raise HTTPException(status_code=403, detail=t("errors.kyc_required", lang))
        if not current_user.email_verified:
            raise HTTPException(status_code=403, detail=t("errors.already_verified", lang))
        current_user.is_carrier = True

    if payload.weight_unit is not None:
        active_trip = await db.execute(
            select(Trip.id).where(
                Trip.carrier_id == current_user.id,
                Trip.status.in_(["open", "full", "in_transit"]),
                Trip.deleted_at.is_(None),
            ).limit(1)
        )
        active_request = await db.execute(
            select(PackageRequest.id).where(
                PackageRequest.sender_id == current_user.id,
                PackageRequest.status.in_(["open", "matched"]),
                PackageRequest.deleted_at.is_(None),
            ).limit(1)
        )
        if active_trip.scalar_one_or_none() or active_request.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=t("errors.weight_unit_active_listings", lang),
            )
        current_user.weight_unit = payload.weight_unit
    if payload.currency is not None:
        current_user.currency = payload.currency
    if payload.payment_method is not None:
        current_user.payment_method = payload.payment_method
    if payload.payment_country is not None:
        current_user.payment_country = payload.payment_country
    if payload.mobile_money_number is not None:
        current_user.mobile_money_number = payload.mobile_money_number
    if payload.iban is not None:
        current_user.iban = payload.iban
    if payload.payout_method is not None:
        if payload.payout_method not in ("mobile_money", "bank"):
            raise HTTPException(status_code=422, detail="payout_method: 'mobile_money' ou 'bank'")
        current_user.payout_method = payload.payout_method
    if payload.bank_holder_name is not None:
        current_user.bank_holder_name = payload.bank_holder_name
    if payload.onboarding_completed is True:
        current_user.onboarding_completed = True

    return {
        "message": t("success.profile_updated", lang),
        "user": _serialize_me(current_user),
    }


@router.post("/me/avatar/sign", response_model=AvatarSignatureResponse)
async def get_avatar_upload_signature(
    current_user: User = Depends(get_current_user),
):
    """
    Génère une signature Cloudinary pour autoriser l'upload de l'avatar.
    Le frontend uploade directement à Cloudinary, sans transit par notre backend.
    """
    try:
        return generate_avatar_upload_signature(current_user.id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.patch("/me/avatar")
async def update_avatar(
    payload: AvatarUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Persiste l'URL de l'avatar après upload réussi côté Cloudinary.
    Vérification anti-spoofing : l'URL doit appartenir au folder de l'user.
    """
    if payload.avatar_url is None:
        # Retrait de la photo
        current_user.avatar_url = None
    else:
        if not validate_avatar_url(payload.avatar_url, current_user.id):
            raise HTTPException(
                status_code=400,
                detail=t("errors.avatar_url_invalid", lang),
            )
        current_user.avatar_url = payload.avatar_url
    return {
        "message": t("success.avatar_updated", lang),
        "avatar_url": current_user.avatar_url,
    }


# ─── Nouveaux endpoints — Phase 2 ───────────────────────────────────────────

@router.patch("/me/notification-preferences")
async def update_notification_preferences(
    payload: NotificationPreferencesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Met à jour les préférences de notifications de l'utilisateur connecté.
    Tous les champs sont optionnels — seuls ceux fournis sont modifiés.
    """
    if payload.notify_by_email is not None:
        current_user.notify_by_email = payload.notify_by_email
    if payload.notify_by_push is not None:
        current_user.notify_by_push = payload.notify_by_push
    if payload.notify_by_sms is not None:
        current_user.notify_by_sms = payload.notify_by_sms

    return {
        "message": t("success.notification_preferences_updated", lang),
        "notify_by_email": current_user.notify_by_email,
        "notify_by_push": current_user.notify_by_push,
        "notify_by_sms": current_user.notify_by_sms,
    }


@router.delete("/me")
async def delete_my_account(
    payload: DeleteAccountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Soft delete du compte de l'utilisateur connecté.

    Sécurité :
      - Demande le mot de passe actuel (anti vol-de-session)
      - Anonymise les données perso (RGPD-compliant)
      - Préserve l'ID, kyc_status, trust_score, created_at pour les stats agrégées
      - Désactive le compte (is_active=False) → login refusé
      - Marque deleted_at=now()

    Les bookings, trips et reviews historiques restent intacts mais référencent
    désormais un user "Utilisateur supprimé".
    """
    if not payload.password:
        raise HTTPException(
            status_code=400,
            detail=t("errors.password_required", lang),
        )

    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(
            status_code=403,
            detail=t("errors.password_invalid", lang),
        )

    # Anonymisation RGPD
    short_id = str(current_user.id).split("-")[0]
    current_user.email = f"deleted_{short_id}@kipar.deleted"
    current_user.phone = None
    current_user.first_name = "Utilisateur"
    current_user.last_name = "supprimé"
    current_user.avatar_url = None
    # Hash impossible à déverrouiller (le ! n'est pas un caractère valide en bcrypt)
    current_user.hashed_password = "!"
    current_user.google_id = None
    current_user.apple_id = None
    current_user.fcm_token = None
    current_user.onfido_applicant_id = None
    current_user.stripe_account_id = None
    current_user.flutterwave_account_id = None

    # Hard delete — anonymisation RGPD complete + flag permanent
    current_user.is_active = False
    current_user.is_permanently_deleted = True
    current_user.deleted_at = datetime.now(timezone.utc)

    return {"message": t("success.account_deleted", lang)}


@router.delete("/me/pause")
async def pause_my_account(
    payload: DeleteAccountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Soft delete — mise en pause du compte.
    Donnees conservees, compte reactivable par l'utilisateur.
    """
    if not payload.password:
        raise HTTPException(status_code=400, detail=t("errors.password_required", lang))
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=403, detail=t("errors.password_invalid", lang))
    current_user.is_active = False
    current_user.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": t("success.account_paused", lang)}


# ─── GET endpoints ──────────────────────────────────────────────────────────

@router.get("/check-username")
async def check_username(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verifie si un username est disponible (temps reel, debounce cote frontend)."""
    username = username.strip().lower()
    if not re.match(r"^[a-z0-9_]{4,15}$", username):
        return {"available": False, "reason": "invalid_format"}
    if username == current_user.username:
        return {"available": True, "reason": "current"}
    existing = await db.execute(
        select(User).where(User.username == username)
    )
    taken = existing.scalar_one_or_none() is not None
    return {"available": not taken, "reason": "taken" if taken else "ok"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return _serialize_me(current_user)


@router.get("/me/limits")
async def get_my_limits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne les compteurs freemium de l'utilisateur."""
    from app.api.v1.endpoints.premium import is_premium_active
    from sqlalchemy import func
    from app.models.booking import Booking
    from app.models.trip import Trip
    from app.models.package_request import PackageRequest
    is_premium = is_premium_active(current_user)
    if is_premium:
        return {
            "is_premium": True,
            "bookings": {"current": 0, "max": None},
            "trips": {"current": 0, "max": None},
            "requests": {"current": 0, "max": None},
        }
    booking_count = await db.execute(
        select(func.count()).where(
            Booking.sender_id == current_user.id,
            Booking.status.in_(["pending", "accepted", "paid", "in_transit"]),
        )
    )
    trip_count = await db.execute(
        select(func.count()).where(
            Trip.carrier_id == current_user.id,
            Trip.status.in_(["open", "full"]),
            Trip.deleted_at.is_(None),
        )
    )
    request_count = await db.execute(
        select(func.count()).where(
            PackageRequest.sender_id == current_user.id,
            PackageRequest.status == "open",
            PackageRequest.deleted_at.is_(None),
        )
    )
    return {
        "is_premium": False,
        "bookings": {"current": booking_count.scalar(), "max": 3},
        "trips": {"current": trip_count.scalar(), "max": 2},
        "requests": {"current": request_count.scalar(), "max": 2},
    }


@router.get("/{user_id}", response_model=PublicUserResponse)
async def get_public_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Profil public — auth requise, données sensibles non exposées."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail=t("errors.user_not_found", lang))

    import asyncio
    sender_q, carrier_q, trips_q, reviews_q = await asyncio.gather(
        db.execute(
            select(func.count(Booking.id)).where(
                Booking.sender_id == user.id,
                Booking.status == "delivered",
            )
        ),
        db.execute(
            select(func.count(Booking.id))
            .join(Trip, Booking.trip_id == Trip.id)
            .where(
                Trip.carrier_id == user.id,
                Booking.status == "delivered",
            )
        ),
        db.execute(
            select(func.count(Trip.id)).where(Trip.carrier_id == user.id)
        ),
        db.execute(
            select(func.count(Review.id), func.avg(Review.score)).where(
                Review.reviewed_id == user.id
            )
        ),
    )
    deliveries_as_sender = sender_q.scalar() or 0
    deliveries_as_carrier = carrier_q.scalar() or 0
    trips_count = trips_q.scalar() or 0
    reviews_count, avg_rating = reviews_q.one()
    reviews_count = reviews_count or 0
    avg_rating = round(avg_rating, 1) if avg_rating is not None else None

    return PublicUserResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        kyc_status=user.kyc_status,
        trust_score=user.trust_score,
        is_carrier=user.is_carrier,
        created_at=user.created_at,
        deliveries_as_sender=deliveries_as_sender,
        deliveries_as_carrier=deliveries_as_carrier,
        trips_count=trips_count,
        reviews_count=reviews_count,
        avg_rating=avg_rating,
        is_premium=user.is_premium,
    )


# ─── Helpers internes ───────────────────────────────────────────────────────

def _serialize_me(user: User) -> dict:
    """Format de l'user complet pour les réponses /me et PATCH /me."""
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "kyc_status": user.kyc_status,
        "trust_score": user.trust_score,
        "penalty_balance": round(getattr(user, "penalty_balance", 0.0) or 0.0, 2),
        "language": user.language,
        "is_sender": user.is_sender,
        "is_carrier": user.is_carrier,
        "is_receiver": user.is_receiver,
        "notify_by_email": user.notify_by_email,
        "notify_by_push": user.notify_by_push,
        "notify_by_sms": user.notify_by_sms,
        "email_verified": user.email_verified,
        "phone_verified": user.phone_verified,
        "weight_unit": user.weight_unit or "kg",
        "currency": user.currency or "EUR",
        "payment_method": user.payment_method,
        "payment_country": user.payment_country,
        "mobile_money_number": user.mobile_money_number,
        "payout_method": user.payout_method,
        "bank_holder_name": user.bank_holder_name,
        "iban": user.iban,
        "onboarding_completed": user.onboarding_completed,
        "is_admin": user.is_admin,
        "username": user.username,
        "username_updated_at": user.username_updated_at.isoformat() if user.username_updated_at else None,
        "address": user.address,
        "totp_enabled": bool(user.totp_enabled),
        "is_premium": bool(user.is_premium),
        "premium_expires_at": user.premium_expires_at.isoformat() if user.premium_expires_at else None,
        "premium_plan": user.premium_plan,
        "pending_trip_id": str(user.pending_trip_id) if user.pending_trip_id else None,
    }


@router.get("/me/export")
async def export_my_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """RGPD - export de toutes les donnees personnelles de l'utilisateur."""
    from app.models.booking import Booking
    from app.models.trip import Trip
    from app.models.review import Review
    from datetime import datetime, timezone

    bookings_r = await db.execute(select(Booking).where(Booking.sender_id == current_user.id))
    bookings = bookings_r.scalars().all()
    trips_r = await db.execute(select(Trip).where(Trip.carrier_id == current_user.id))
    trips = trips_r.scalars().all()
    reviews_r = await db.execute(select(Review).where(Review.reviewer_id == current_user.id))
    reviews = reviews_r.scalars().all()

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "profile": {
            "id": str(current_user.id),
            "email": current_user.email,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "username": current_user.username,
            "phone": current_user.phone,
            "address": current_user.address,
            "language": current_user.language,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "cgu_accepted_at": current_user.cgu_accepted_at.isoformat() if current_user.cgu_accepted_at else None,
        },
        "bookings": [
            {"id": str(b.id), "status": b.status, "amount": b.amount,
             "created_at": b.created_at.isoformat() if b.created_at else None}
            for b in bookings
        ],
        "trips": [
            {"id": str(t.id), "origin": t.origin, "destination": t.destination,
             "departure_date": t.departure_date.isoformat() if t.departure_date else None}
            for t in trips
        ],
        "reviews_given": [
            {"id": str(r.id), "rating": r.rating, "comment": r.comment,
             "created_at": r.created_at.isoformat() if r.created_at else None}
            for r in reviews
        ],
    }


@router.patch("/me/accept-cgu")
async def accept_cgu(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enregistre l'acceptation des CGU par l'utilisateur."""
    from datetime import datetime, timezone
    current_user.cgu_accepted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"cgu_accepted_at": current_user.cgu_accepted_at.isoformat()}


@router.delete("/me/pending-trip")
async def clear_pending_trip(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Efface le trajet d'interet memorise (consomme apres redirection)."""
    current_user.pending_trip_id = None
    await db.commit()
    return {"message": "pending_trip_cleared"}
