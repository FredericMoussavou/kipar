"""
KiparTrust — score de confiance multi-dimensionnel (0 à 100).

Dimensions :
  - KYC vérifié          : 25 pts
  - Livraisons réussies  : jusqu'à 30 pts (1pt par livraison, max 30)
  - Taux de succès       : jusqu'à 20 pts (% bookings livrés vs total)
  - Ancienneté           : jusqu'à 15 pts (1pt par mois, max 15)
  - Avis communauté      : jusqu'à 10 pts (moyenne des notes /5 * 10)
"""
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.booking import Booking
from app.models.review import Review
from app.models.user import User


async def compute_trust_score(user: User, db: AsyncSession) -> float:
    score = 0.0

    # 1. KYC vérifié — 25 pts
    if user.kyc_status == "verified":
        score += 25

    # 2. Livraisons réussies — jusqu'à 30 pts
    result = await db.execute(
        select(func.count(Booking.id)).where(
            Booking.sender_id == user.id,
            Booking.status == "delivered"
        )
    )
    delivered_count = result.scalar() or 0
    score += min(delivered_count, 30)

    # 3. Taux de succès — jusqu'à 20 pts
    result = await db.execute(
        select(func.count(Booking.id)).where(
            Booking.sender_id == user.id,
            Booking.status.in_(["delivered", "refused", "disputed"])
        )
    )
    total = result.scalar() or 0
    if total > 0:
        success_rate = delivered_count / total
        score += success_rate * 20

    # 4. Ancienneté — jusqu'à 15 pts (1 pt par mois)
    months = (datetime.now(timezone.utc) - user.created_at).days // 30
    score += min(months, 15)

    # 5. Avis communauté — jusqu'à 10 pts
    result = await db.execute(
        select(func.avg(Review.score)).where(Review.reviewed_id == user.id)
    )
    avg_score = result.scalar()
    if avg_score:
        score += (avg_score / 5.0) * 10

    return round(min(score, 100.0), 1)


async def update_trust_score(user: User, db: AsyncSession) -> float:
    """Recalcule et sauvegarde le score KiparTrust."""
    new_score = await compute_trust_score(user, db)
    user.trust_score = new_score
    return new_score
