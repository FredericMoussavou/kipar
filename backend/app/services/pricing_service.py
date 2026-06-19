from app.core.config import settings


def compute_kg_amount(weight_kg: float, price_per_kg: float, is_urgent: bool) -> dict:
    """Tarif colis au kg : transport + 15% service + forfait dossier (urgent ou normal).

    Le total est calcule par la formule historique exacte (round unique) pour
    garantir l'iso-montant ; service_fee est derive pour l'affichage.
    """
    base = round(weight_kg * price_per_kg, 2)
    flat_fee = settings.URGENT_FLAT_FEE if is_urgent else settings.BOOKING_FLAT_FEE
    total = round(base * (1 + settings.SERVICE_FEE_SENDER_PERCENT) + flat_fee, 2)
    service_fee = round(total - base - flat_fee, 2)
    return {"base": base, "service_fee": service_fee, "flat_fee": flat_fee, "total": total}


def compute_small_amount(small_package_price: float) -> dict:
    """Tarif petit colis : prix transporteur + part KIPAR (pas de % service)."""
    base = round(small_package_price, 2)
    flat_fee = settings.SMALL_PACKAGE_KIPAR_FEE
    total = round(small_package_price + settings.SMALL_PACKAGE_KIPAR_FEE, 2)
    return {"base": base, "service_fee": 0.0, "flat_fee": flat_fee, "total": total}


def compute_carrier_payout(booking) -> float:
    """Montant net a verser au transporteur a la livraison (Modele A).
    - kg    : base - 2% (SERVICE_FEE_CARRIER_PERCENT)
    - small : base entiere (la marge KIPAR est le forfait fixe, pas de %)
    base = booking.base_amount, ou reconstituee si NULL (anciens bookings).
    """
    base = booking.base_amount
    if base is None:
        if booking.package_mode == "small":
            base = booking.amount - settings.SMALL_PACKAGE_KIPAR_FEE
        else:
            flat = booking.booking_flat_fee_amount or settings.BOOKING_FLAT_FEE
            base = (booking.amount - flat) / (1 + settings.SERVICE_FEE_SENDER_PERCENT)
    base = max(0.0, base)
    if booking.package_mode == "small":
        return round(base, 2)
    return round(base * (1 - settings.SERVICE_FEE_CARRIER_PERCENT), 2)
