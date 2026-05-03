"""
KiparTrust — score de confiance multi-dimensionnel (0 à 100).

Base : 50 points pour tout nouveau compte.
Le score fluctue selon les actions de l'utilisateur.

Facteurs positifs (max +50) :
  - KYC vérifié          : +15 pts
  - Ancienneté           : +1pt/mois, max +10 pts
  - Livraisons réussies  : +1pt chacune, max +15 pts
  - Note moyenne avis    : jusqu'à +10 pts

Facteurs négatifs :
  - Litiges ouverts      : -10 pts chacun
  - Réservations refusées (transporteur) : -5 pts chacune (max -15)

Bornes : min 0, max 100.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
from app.models.user import User
from app.models.booking import Booking
from app.models.review import Review
from app.models.trip import Trip


BASE_SCORE = 50.0


async def compute_trust_score(user: User, db: AsyncSession) -> float:
    score = BASE_SCORE

    # +15 KYC vérifié
    if user.kyc_status == "verified":
        score += 15.0

    # +1pt/mois d'ancienneté, max +10
    if user.created_at:
        now = datetime.now(timezone.utc)
        created = user.created_at.replace(tzinfo=timezone.utc) if user.created_at.tzinfo is None else user.created_at
        months = max(0, (now.year - created.year) * 12 + (now.month - created.month))
        score += min(months, 10)

    # +1pt par livraison réussie en tant que transporteur (max +15)
    delivered = await db.execute(
        select(func.count(Booking.id)).join(Trip, Trip.id == Booking.trip_id).where(
            Trip.carrier_id == user.id,
            Booking.status == "delivered"
        )
    )
    delivered_count = delivered.scalar() or 0
    score += min(delivered_count, 15)

    # +max 10pts selon note moyenne des avis reçus
    avg_result = await db.execute(
        select(func.avg(Review.score)).where(Review.reviewed_id == user.id)
    )
    avg_score = avg_result.scalar()
    if avg_score:
        score += round((avg_score / 5.0) * 10, 1)

    # -10pts par litige ouvert (en tant qu'expéditeur)
    disputes = await db.execute(
        select(func.count(Booking.id)).where(
            Booking.sender_id == user.id,
            Booking.status == "disputed"
        )
    )
    dispute_count = disputes.scalar() or 0
    score -= dispute_count * 10.0

    # -5pts par réservation refusée côté transporteur (max -15)
    refused = await db.execute(
        select(func.count(Booking.id)).join(Trip, Trip.id == Booking.trip_id).where(
            Trip.carrier_id == user.id,
            Booking.status == "refused"
        )
    )
    refused_count = refused.scalar() or 0
    score -= min(refused_count * 5.0, 15.0)

    return round(max(0.0, min(score, 100.0)), 1)


async def update_trust_score(user: User, db: AsyncSession) -> float:
    """Recalcule et sauvegarde le score KiparTrust."""
    new_score = await compute_trust_score(user, db)
    user.trust_score = new_score
    await db.commit()
    return new_score
