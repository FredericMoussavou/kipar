import stripe
from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


async def create_payment_intent(
    amount_eur: float,
    booking_id: str,
    carrier_stripe_account: str | None = None,
) -> dict:
    """
    Crée un PaymentIntent Stripe en mode escrow.
    - amount_eur  : montant en euros
    - booking_id  : référence métier
    - carrier_stripe_account : compte Connect du transporteur (pour le transfert final)

    En sandbox, si pas de clé Stripe configurée, retourne un objet simulé.
    """
    if not settings.STRIPE_SECRET_KEY:
        # Mode simulation — pas de clé Stripe
        return {
            "id": f"pi_simulated_{booking_id[:8]}",
            "client_secret": f"pi_simulated_{booking_id[:8]}_secret_test",
            "status": "requires_payment_method",
        }

    intent_params = {
        "amount": int(amount_eur * 100),  # Stripe travaille en centimes
        "currency": "eur",
        "metadata": {"booking_id": booking_id},
        "capture_method": "manual",  # on capture manuellement après acceptation
    }

    if carrier_stripe_account:
        intent_params["transfer_data"] = {
            "destination": carrier_stripe_account
        }

    intent = stripe.PaymentIntent.create(**intent_params)
    return {"id": intent.id, "client_secret": intent.client_secret, "status": intent.status}


async def capture_payment_intent(payment_intent_id: str) -> bool:
    """Capture le paiement après acceptation du transporteur."""
    if payment_intent_id.startswith("pi_simulated"):
        return True
    try:
        intent = stripe.PaymentIntent.capture(payment_intent_id)
        return intent.status == "succeeded"
    except stripe.StripeError:
        return False


async def cancel_payment_intent(payment_intent_id: str, booking_fee: float = 1.5) -> bool:
    """Annule le PaymentIntent en cas de refus transporteur.
    Les frais de gestion (1.5EUR) sont conserves par KIPAR.
    """
    if payment_intent_id.startswith("pi_simulated"):
        return True
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        if intent.status in ("requires_capture", "requires_confirmation", "requires_payment_method"):
            stripe.PaymentIntent.cancel(payment_intent_id)
        return True
    except stripe.StripeError:
        return False

async def settle_cancellation_refund(escrow_ref, refund_amount, carrier_amount, carrier_stripe_account, booking_id):
    """Regle une annulation cote Stripe selon l'etat reel du PaymentIntent.

    - requires_capture (hold non capture, cas 100%) -> cancel : libere le blocage,
      l'expediteur n'est jamais debite (evite le bug 'uncaptured Charge').
    - succeeded (fonds captures chez KIPAR) -> Refund (partiel ou total si >0)
      + Transfer compensation transporteur (si >0).
    - canceled / requires_payment_method -> rien a faire.
    """
    pi = stripe.PaymentIntent.retrieve(escrow_ref)
    if pi.status == "requires_capture":
        await cancel_payment_intent(escrow_ref)
    elif pi.status == "succeeded":
        if refund_amount and refund_amount > 0:
            stripe.Refund.create(
                payment_intent=escrow_ref,
                amount=int(refund_amount * 100),
            )
        if carrier_amount and carrier_amount > 0 and carrier_stripe_account and not carrier_stripe_account.startswith("simulated"):
            stripe.Transfer.create(
                amount=int(carrier_amount * 100),
                currency="eur",
                destination=carrier_stripe_account,
                description=f"KIPAR compensation annulation booking {booking_id}",
            )


async def release_payment_to_carrier(
    payment_intent_id: str,
    carrier_stripe_account: str,
    amount_eur: float,
) -> bool:
    """
    Libère le paiement vers le compte du transporteur après livraison.
    Commission Kipar : 15% expediteur + 2% transporteur = 83% net transporteur.
    Commission minimum absolue : max(17%, MIN_COMMISSION).
    """
    if payment_intent_id.startswith("pi_simulated"):
        return True
    try:
        from app.core.config import settings
        total_fee_rate = settings.SERVICE_FEE_SENDER_PERCENT + settings.SERVICE_FEE_CARRIER_PERCENT
        kipar_fee = max(amount_eur * total_fee_rate, settings.MIN_COMMISSION)
        carrier_amount = int((amount_eur - kipar_fee) * 100)
        stripe.Transfer.create(
            amount=carrier_amount,
            currency="eur",
            destination=carrier_stripe_account,
            transfer_group=payment_intent_id,
        )
        return True
    except stripe.StripeError:
        return False
