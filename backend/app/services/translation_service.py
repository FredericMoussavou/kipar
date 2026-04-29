import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# Langues supportées par Kipar
SUPPORTED_LANGUAGES = {
    "fr": "FR",
    "en": "EN-GB",
    "ar": "AR",
    "pt": "PT-PT",
    "es": "ES",
}


async def translate_message(text: str, target_lang: str) -> str | None:
    """
    Traduit un message via DeepL API.
    Retourne le texte traduit ou None si échec/simulation.
    
    target_lang : code langue Kipar ('fr', 'en', 'ar'...)
    """
    if not settings.DEEPL_API_KEY:
        logger.info(f"[TRANSLATION SIMULATED] → {target_lang}: {text[:30]}...")
        return None  # Pas de traduction en simulation — le message original est affiché

    deepl_target = SUPPORTED_LANGUAGES.get(target_lang)
    if not deepl_target:
        return None

    try:
        import deepl
        translator = deepl.Translator(settings.DEEPL_API_KEY)
        result = translator.translate_text(text, target_lang=deepl_target)
        return result.text
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return None


async def detect_language(text: str) -> str | None:
    """Détecte la langue d'un texte via DeepL."""
    if not settings.DEEPL_API_KEY:
        return None
    try:
        import deepl
        translator = deepl.Translator(settings.DEEPL_API_KEY)
        result = translator.translate_text(text, target_lang="EN-GB")
        detected = result.detected_source_lang
        # Convertit le code DeepL en code Kipar
        for kipar_code, deepl_code in SUPPORTED_LANGUAGES.items():
            if deepl_code.startswith(detected):
                return kipar_code
        return detected.lower()
    except Exception as e:
        logger.error(f"Language detection failed: {e}")
        return None
