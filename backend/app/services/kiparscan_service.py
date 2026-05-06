import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

PROHIBITED_KEYWORDS = [
    "weapon", "gun", "knife", "explosive", "drug", "narcotic", "cannabis",
    "firearm", "ammunition", "arme", "couteau", "explosif", "drogue",
    "stupefiant", "cocaine", "heroin", "tobacco", "cigarette",
    "alcohol", "alcool", "currency", "cash", "counterfeit",
]


async def analyze_package_image(image_base64: str, destination_country: str = "SN") -> dict:
    if not settings.ANTHROPIC_API_KEY:
        logger.info("[KIPARSCAN SIMULATED] Analyse simulee -- pas de cle Anthropic")
        return {
            "content_description": "Contenu simule : vetements et accessoires",
            "estimated_weight_kg": 2.5,
            "dimensions_estimate": "40x30x15 cm",
            "prohibited_flag": False,
            "prohibited_reason": None,
            "confidence": "medium",
            "simulated": True,
        }

    try:
        import anthropic
        import json

        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        prompt = f"""Tu es un agent de controle douanier expert. Analyse cette photo de colis destine a {destination_country}.

Reponds UNIQUEMENT en JSON valide avec ces champs :
{{
  "content_description": "description precise du contenu visible",
  "estimated_weight_kg": nombre_decimal,
  "dimensions_estimate": "LxlxH en cm si estimable",
  "prohibited_flag": true/false,
  "prohibited_reason": "raison si prohibe, sinon null",
  "confidence": "low|medium|high"
}}

Produits prohibes a detecter : armes, explosifs, drogues, stupefiants, tabac en grande quantite, alcool en grande quantite, devises en especes, contrefacons.
Ne reponds qu'avec le JSON, sans markdown ni texte autour."""

        response = await client.messages.create(
            model="claude-opus-4-5",
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_base64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )

        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())

        description_lower = result.get("content_description", "").lower()
        for keyword in PROHIBITED_KEYWORDS:
            if keyword in description_lower:
                result["prohibited_flag"] = True
                if not result.get("prohibited_reason"):
                    result["prohibited_reason"] = f"Mot-cle detecte : {keyword}"
                break

        return result

    except Exception as e:
        logger.error(f"KiparScan failed: {e}")
        return None
