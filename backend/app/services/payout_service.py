"""Service centralise de versement transporteur avec tracabilite (PayoutLedger).

Remplace la logique dupliquee (payments.py + booking_tasks.py) et surtout
la "fausse simulation" : desormais tout montant du est trace, meme non verse.
"""
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payout_ledger import PayoutLedger

logger = logging.getLogger("kipar")


async def record_and_release_payout(db: AsyncSession, booking, carrier) -> PayoutLedger | None:
    """Enregistre (et tente de verser) le payout du a un transporteur pour un booking livre.

    - Idempotent : si un payout 'paid' existe deja pour ce booking, ne refait rien.
    - Si le rail est configure et le versement reussit -> status='paid'.
    - Sinon -> status='pending' avec failure_reason (argent trace comme du).

    Retourne l'entree PayoutLedger creee/existante (ou None si rien a verser).
    """
    from app.services.pricing_service import compute_carrier_payout
    from app.services.penalty_service import apply_penalty_deduction

    # Idempotence : deja verse pour ce booking ?
    existing = await db.execute(
        select(PayoutLedger).where(
            PayoutLedger.booking_id == booking.id,
            PayoutLedger.status == "paid",
        )
    )
    if existing.scalar_one_or_none():
        logger.info(f"[PAYOUT] Booking {booking.id} deja verse, skip")
        return None

    # Montant net (apres penalites)
    gross = compute_carrier_payout(booking)
    if carrier:
        net, deducted, balance = await apply_penalty_deduction(db, carrier, gross, booking.id)
    else:
        net, deducted, balance = gross, 0.0, 0.0

    currency = getattr(booking, "currency", None) or "EUR"
    rail = booking.payment_rail or "none"

    # Rien a verser (tout absorbe par les penalites)
    if net <= 0:
        entry = PayoutLedger(
            carrier_id=carrier.id if carrier else booking.sender_id,
            booking_id=booking.id,
            amount=0.0, currency=currency, rail=rail,
            status="paid", failure_reason="fully_deducted",
            paid_at=datetime.now(timezone.utc),
        )
        db.add(entry)
        return entry

    status = "pending"
    reason = None
    external_ref = None

    if rail == "stripe":
        if carrier and carrier.stripe_account_id:
            from app.services.stripe_service import release_payment_to_carrier
            ok = await release_payment_to_carrier(
                payment_intent_id=booking.escrow_ref,
                carrier_stripe_account=carrier.stripe_account_id,
                carrier_amount_eur=net,
            )
            status = "paid" if ok else "failed"
            reason = None if ok else "stripe_transfer_failed"
        else:
            status = "pending"
            reason = "no_stripe_account"
    elif rail == "pawapay":
        if carrier and carrier.mobile_money_number and carrier.mobile_money_provider:
            from app.services.pawapay_service import initiate_payout
            try:
                resp = await initiate_payout(
                    amount=net, currency=currency,
                    phone=carrier.mobile_money_number,
                    provider=carrier.mobile_money_provider,
                    booking_id=str(booking.id),
                )
                ok = resp.get("status") in ("ACCEPTED", "COMPLETED")
                status = "paid" if ok else "failed"
                reason = None if ok else "pawapay_rejected"
                external_ref = resp.get("payoutId")
            except Exception as e:
                logger.error(f"[PAYOUT] PawaPay error booking {booking.id}: {e}")
                status = "failed"
                reason = "pawapay_error"
        else:
            status = "pending"
            reason = "no_mobile_config"
    else:
        status = "pending"
        reason = "no_rail"

    entry = PayoutLedger(
        carrier_id=carrier.id if carrier else booking.sender_id,
        booking_id=booking.id,
        amount=round(net, 2), currency=currency, rail=rail,
        status=status, failure_reason=reason, external_ref=external_ref,
        paid_at=datetime.now(timezone.utc) if status == "paid" else None,
    )
    db.add(entry)
    logger.info(f"[PAYOUT] Booking {booking.id}: {status} ({reason or 'ok'}) net={net:.2f} {currency}")
    return entry