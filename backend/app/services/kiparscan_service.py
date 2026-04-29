import base64
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# Liste des produits prohibés selon les principales réglementations douanières
PROHIBITED_KEYWORDS = [
    "weapon", "gun", "knife", "explosive", "drug", "narcotic", "cannabis",
    "firearm", "ammunition", "arme", "couteau", "explosif", "drogue",
    "stupéfiant", "cannabis", "cocaine", "heroin", "tobacco", "cigarette",
    "alcohol", "alcool", "currency", "cash", "counterfeit",
]


async def analyze_package_image(image_base64: str, destination_country: str = "SN") -> dict:
    """
    Analyse une photo de colis via OpenAI Vision (GPT-4o).
    
    Retourne :
    - content_description : description du contenu détecté
    - estimated_weight_kg : poids estimé
    - dimensions_estimate : dimensions estimées
    - prohibited_flag : True si produit potentiellement prohibé
    - prohibited_reason : raison du flag si applicable
    - confidence : niveau de confiance (low / medium / high)
    
    En simulation (pas de clé OpenAI), retourne un résultat fictif.
    """
    if not settings.OPENAI_API_KEY:
        logger.info("[KIPARSCAN SIMULATED] Analyse simulée — pas de clé OpenAI")
        return {
            "content_description": "Contenu simulé : vêtements et accessoires",
            "estimated_weight_kg": 2.5,
            "dimensions_estimate": "40x30x15 cm",
            "prohibited_flag": False,
            "prohibited_reason": None,
            "confidence": "medium",
            "simulated": True,
        }

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        prompt = f"""Tu es un agent de contrôle douanier expert. Analyse cette photo de colis destiné à {destination_country}.

Réponds UNIQUEMENT en JSON avec ces champs :
{{
  "content_description": "description précise du contenu visible",
  "estimated_weight_kg": nombre_décimal,
  "dimensions_estimate": "LxlxH en cm si estimable",
  "prohibited_flag": true/false,
  "prohibited_reason": "raison si prohibé, sinon null",
  "confidence": "low|medium|high"
}}

Produits prohibés à détecter : armes, explosifs, drogues, stupéfiants, tabac en grande quantité, alcool en grande quantité, devises en espèces, contrefaçons."""

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            max_tokens=500,
            response_format={"type": "json_object"},
        )

        import json
        result = json.loads(response.choices[0].message.content)

        # Double vérification des mots-clés prohibés
        description_lower = result.get("content_description", "").lower()
        for keyword in PROHIBITED_KEYWORDS:
            if keyword in description_lower:
                result["prohibited_flag"] = True
                if not result.get("prohibited_reason"):
                    result["prohibited_reason"] = f"Mot-clé détecté : {keyword}"
                break

        return result

    except Exception as e:
        logger.error(f"KiparScan failed: {e}")
        return None
