"""Adaptateur virement SEPA sortant (banque pro KIPAR : Qonto).

Sans QONTO_API_KEY, retourne {"status": "not_configured"} : le payout reste
'pending / bank_adapter_not_configured' dans le ledger et sera rejoue
automatiquement par le worker des que la cle sera en place.
Declencheur d'implementation reelle : "J'ai mon compte Qonto".
"""
import logging

from app.core.config import settings

logger = logging.getLogger("kipar")


async def initiate_sepa_transfer(
    iban: str, holder_name: str, amount_eur: float, reference: str
) -> dict:
    """Initie un virement SEPA vers l'IBAN du transporteur.

    Retourne {"status": "not_configured"} tant que l'adaptateur n'est pas branche.
    """
    if not settings.QONTO_API_KEY:
        logger.info(
            f"[BANK] Adaptateur non configure - virement {amount_eur:.2f} EUR "
            f"vers {iban[:8]}... differe (rejoue par le worker)"
        )
        return {"status": "not_configured"}
    # Integration Qonto a brancher (beneficiaire + external transfer).
    # Volontairement non implemente tant que le compte n'existe pas :
    # pas d'appel API invente et non teste avec de l'argent reel.
    raise NotImplementedError(
        "Adaptateur Qonto non implemente - retirer QONTO_API_KEY ou brancher l'integration"
    )
