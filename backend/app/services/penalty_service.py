"""Service de gestion des penalites transporteur (dette reportee).

Centralise la mise a jour de User.penalty_balance et l'ecriture du releve
PenaltyLedger. Aucune de ces fonctions ne commit : le commit est gere par
l'appelant (flux existant).
"""
from app.models.penalty_ledger import PenaltyLedger


async def add_penalty(db, carrier, booking_id, amount, description=None):
    """Ajoute une penalite au transporteur (la dette monte) + ligne ledger.

    carrier : objet User attache a la session.
    Retourne le nouveau solde.
    """
    current = carrier.penalty_balance or 0.0
    carrier.penalty_balance = round(current + amount, 2)
    db.add(PenaltyLedger(
        carrier_id=carrier.id,
        booking_id=booking_id,
        amount=round(amount, 2),
        entry_type="penalty",
        balance_after=carrier.penalty_balance,
        description=description,
    ))
    return carrier.penalty_balance


async def apply_penalty_deduction(db, carrier, payout, booking_id, description=None):
    """Applique la dette du transporteur sur un versement (payout).

    Retourne (net, deduct, balance_after) :
      - net     : montant a verser reellement au transporteur (payout - deduct)
      - deduct  : montant retenu au titre de la dette (>= 0)
      - balance_after : solde de penalite restant
    Ecrit une ligne ledger seulement si deduct > 0. Ne commit pas.
    """
    debt = carrier.penalty_balance or 0.0
    if debt <= 0 or payout <= 0:
        return round(payout, 2), 0.0, round(debt, 2)
    deduct = round(min(debt, payout), 2)
    net = round(payout - deduct, 2)
    carrier.penalty_balance = round(debt - deduct, 2)
    db.add(PenaltyLedger(
        carrier_id=carrier.id,
        booking_id=booking_id,
        amount=-deduct,
        entry_type="deduction",
        balance_after=carrier.penalty_balance,
        description=description or f"Deduction sur versement booking {booking_id}",
    ))
    return net, deduct, carrier.penalty_balance