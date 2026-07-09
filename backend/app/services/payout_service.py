"""Service centralise de versement transporteur avec tracabilite (PayoutLedger).

Cycle de vie :
  delivered -> schedule_payout() : entree 'scheduled', due_at = +48h (fenetre litige)
  worker horaire process_due_payouts -> execute_payout() : cascade de versement

Cascade (choix du transporteur, jamais d'obligation Stripe) :
  payout_method='mobile_money' -> PawaPay (conversion EUR->CFA, taux fixe)
  payout_method='bank'         -> virement SEPA Qonto (adaptateur, differe sans cle)
  aucun choix -> legacy : Stripe Connect (si rail stripe), sinon config mobile,
                 sinon IBAN, sinon pending 'no_payout_method' + notification.

Garanties :
  - le montant du ledger reste en EUR (reference comptable), la conversion CFA
    n'existe que dans l'appel PawaPay ;
  - anti double versement : un payout PawaPay initie (external_ref) est
    re-verifie, jamais re-initie ;
  - penalites deduites une seule fois (premiere execution) ;
  - etat du booking re-verifie au moment T (delivered, pas d'incident actif) ;
  - les mises en attente de configuration ne consomment pas de tentative.
"""
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payout_ledger import PayoutLedger

logger = logging.getLogger("kipar")

EUR_CFA_RATE = 655.957  # taux fixe EUR -> XAF/XOF (arrimage CFA)
PROVIDER_CURRENCY = {
    "ORANGE_SEN": "XOF", "FREE_SEN": "XOF",
    "ORANGE_CIV": "XOF", "MTN_MOMO_CIV": "XOF",
    "ORANGE_CMR": "XAF", "MTN_MOMO_CMR": "XAF",
    "AIRTEL_GAB": "XAF",
}
MAX_ATTEMPTS = 5


async def schedule_payout(
    db: AsyncSession, booking, carrier, delay_hours: int = 48
) -> PayoutLedger | None:
    """Programme le versement du a un transporteur (statut 'scheduled').

    Idempotent : None si deja paye ; retourne l'entree ouverte existante
    si deja programmee. Le montant enregistre est le brut indicatif ;
    le net (penalites) est recalcule a la premiere execution.
    """
    from app.services.pricing_service import compute_carrier_payout

    result = await db.execute(
        select(PayoutLedger).where(PayoutLedger.booking_id == booking.id)
    )
    entries = result.scalars().all()
    if any(e.status == "paid" for e in entries):
        logger.info(f"[PAYOUT] Booking {booking.id} deja verse, skip")
        return None
    open_entries = [e for e in entries if e.status in ("scheduled", "pending", "failed")]
    if open_entries:
        return open_entries[0]

    gross = compute_carrier_payout(booking)
    entry = PayoutLedger(
        carrier_id=carrier.id if carrier else booking.sender_id,
        booking_id=booking.id,
        amount=round(gross, 2), currency="EUR", rail="auto",
        status="scheduled",
        due_at=datetime.now(timezone.utc) + timedelta(hours=delay_hours),
    )
    db.add(entry)
    logger.info(
        f"[PAYOUT] Booking {booking.id}: programme a +{delay_hours}h (brut={gross:.2f} EUR)"
    )
    return entry


async def execute_payout(db: AsyncSession, entry: PayoutLedger, booking, carrier) -> PayoutLedger:
    """Execute un payout du : garde-fous, net, cascade, mise a jour de l'entree."""
    from app.services.pricing_service import compute_carrier_payout
    from app.services.penalty_service import apply_penalty_deduction

    now = datetime.now(timezone.utc)
    previous_reason = entry.failure_reason

    def hold(reason: str) -> PayoutLedger:
        # Attente de configuration/confirmation : ne consomme pas de tentative
        entry.status = "pending"
        entry.failure_reason = reason
        logger.info(f"[PAYOUT] Booking {entry.booking_id}: en attente ({reason})")
        return entry

    def fail(reason: str) -> PayoutLedger:
        entry.status = "failed"
        entry.failure_reason = reason
        entry.attempts = (entry.attempts or 0) + 1
        logger.warning(
            f"[PAYOUT] Booking {entry.booking_id}: echec ({reason}), tentative {entry.attempts}"
        )
        return entry

    def paid(external_ref: str | None = None) -> PayoutLedger:
        entry.status = "paid"
        entry.failure_reason = None
        if external_ref:
            entry.external_ref = external_ref
        entry.paid_at = now
        logger.info(
            f"[PAYOUT] Booking {entry.booking_id}: verse ({entry.rail}) net={entry.amount:.2f} EUR"
        )
        return entry

    # --- Garde-fous : etat du booking re-verifie au moment T -------------
    if booking is None or booking.status != "delivered":
        return hold("booking_not_delivered")
    deadline = getattr(booking, "incident_response_deadline", None)
    if deadline is not None and deadline > now:
        return hold("active_incident")

    # --- Anti double versement : payout PawaPay deja initie --------------
    if entry.external_ref and entry.rail == "pawapay":
        from app.services.pawapay_service import check_payout_status
        try:
            check = await check_payout_status(entry.external_ref)
            st = (check.get("data") or {}).get("status")
        except Exception as e:
            logger.error(f"[PAYOUT] check payout {entry.external_ref}: {e}")
            return hold("awaiting_confirmation")
        if st == "COMPLETED":
            return paid()
        if st == "FAILED":
            entry.external_ref = None
            return fail("pawapay_failed")
        return hold("awaiting_confirmation")

    # --- Montant net : penalites deduites une seule fois ------------------
    if entry.status == "scheduled":
        gross = compute_carrier_payout(booking)
        if carrier:
            net, _deducted, _bal = await apply_penalty_deduction(db, carrier, gross, booking.id)
        else:
            net = gross
        entry.amount = round(net, 2)
    net = entry.amount

    if net <= 0:
        entry.rail = "none"
        entry.failure_reason = "fully_deducted"
        entry.status = "paid"
        entry.paid_at = now
        return entry

    # --- Branches de versement -------------------------------------------
    async def attempt_mobile() -> PayoutLedger:
        from app.services.pawapay_service import initiate_payout, check_payout_status
        import asyncio
        currency = PROVIDER_CURRENCY.get(carrier.mobile_money_provider)
        if not currency:
            return hold("unsupported_provider")
        amount_cfa = round(net * EUR_CFA_RATE)
        entry.rail = "pawapay"
        try:
            resp = await initiate_payout(
                amount=amount_cfa, currency=currency,
                phone=carrier.mobile_money_number,
                provider=carrier.mobile_money_provider,
                booking_id=str(booking.id),
            )
        except Exception as e:
            logger.error(f"[PAYOUT] PawaPay error booking {booking.id}: {e}")
            return fail("pawapay_error")
        if resp.get("status") not in ("ACCEPTED", "ENQUEUED", "COMPLETED"):
            return fail("pawapay_rejected")
        entry.external_ref = resp.get("payoutId")
        if str(entry.external_ref or "").startswith("simulated_"):
            return paid()
        # Confirmation courte ; sinon re-verification au prochain passage du worker
        for _ in range(3):
            await asyncio.sleep(4)
            try:
                check = await check_payout_status(entry.external_ref)
                st = (check.get("data") or {}).get("status")
            except Exception:
                break
            if st == "COMPLETED":
                return paid()
            if st == "FAILED":
                entry.external_ref = None
                return fail("pawapay_failed")
        return hold("awaiting_confirmation")

    async def attempt_bank() -> PayoutLedger:
        from app.services.bank_transfer_service import initiate_sepa_transfer
        entry.rail = "bank"
        holder = carrier.bank_holder_name or (
            f"{getattr(carrier, 'first_name', '') or ''} {getattr(carrier, 'last_name', '') or ''}".strip()
        )
        try:
            resp = await initiate_sepa_transfer(
                iban=carrier.iban,
                holder_name=holder,
                amount_eur=net,
                reference=f"KIPAR {str(booking.id)[:8]}",
            )
        except Exception as e:
            logger.error(f"[PAYOUT] Bank transfer error booking {booking.id}: {e}")
            return fail("bank_transfer_error")
        st = resp.get("status")
        if st == "not_configured":
            return hold("bank_adapter_not_configured")
        if st in ("paid", "processing", "pending", "settled", "completed"):
            return paid(resp.get("transfer_id"))
        return fail("bank_transfer_rejected")

    async def attempt_stripe() -> PayoutLedger:
        from app.services.stripe_service import release_payment_to_carrier
        entry.rail = "stripe"
        ok = await release_payment_to_carrier(
            payment_intent_id=booking.escrow_ref,
            carrier_stripe_account=carrier.stripe_account_id,
            carrier_amount_eur=net,
        )
        return paid() if ok else fail("stripe_transfer_failed")

    # --- Cascade -----------------------------------------------------------
    method = carrier.payout_method if carrier else None

    if method == "mobile_money":
        if not (carrier.mobile_money_number and carrier.mobile_money_provider):
            return hold("mobile_config_incomplete")
        return await attempt_mobile()

    if method == "bank":
        if not carrier.iban:
            return hold("bank_config_incomplete")
        return await attempt_bank()

    # Aucun choix explicite : fallback legacy
    if carrier and carrier.stripe_account_id and booking.payment_rail == "stripe":
        return await attempt_stripe()
    if carrier and carrier.mobile_money_number and carrier.mobile_money_provider:
        return await attempt_mobile()
    if carrier and carrier.iban:
        return await attempt_bank()

    held = hold("no_payout_method")
    if carrier and previous_reason != "no_payout_method":
        try:
            from app.services.notif_db_service import create_notification
            await create_notification(
                db=db, user_id=carrier.id,
                type="payout_method_missing",
                title="Moyen de versement requis",
                body="Renseignez votre wallet mobile money ou votre IBAN pour recevoir votre paiement.",
                link="/profile",
            )
        except Exception:
            pass
    return held


async def record_and_release_payout(db: AsyncSession, booking, carrier) -> PayoutLedger | None:
    """Compat (/release manuel, admin) : programme comme du immediatement puis execute.

    Retourne None si deja verse (idempotence), sinon l'entree mise a jour.
    """
    entry = await schedule_payout(db, booking, carrier, delay_hours=0)
    if entry is None:
        return None
    return await execute_payout(db, entry, booking, carrier)
