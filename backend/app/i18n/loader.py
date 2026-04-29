import json
from pathlib import Path
from functools import lru_cache

SUPPORTED_LANGUAGES = ["fr", "en"]
DEFAULT_LANGUAGE = "fr"

I18N_DIR = Path(__file__).parent


@lru_cache(maxsize=10)
def load_translations(lang: str) -> dict:
    """
    Charge le fichier JSON de traductions.
    lru_cache évite de relire le fichier à chaque requête.
    Fallback sur 'fr' si la langue n'est pas supportée.
    """
    if lang not in SUPPORTED_LANGUAGES:
        lang = DEFAULT_LANGUAGE
    path = I18N_DIR / f"{lang}.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def t(key: str, lang: str = DEFAULT_LANGUAGE, **kwargs) -> str:
    """
    Traduit une clé.
    key  : chemin pointé ex: 'errors.trip_not_found'
    lang : 'fr' ou 'en'
    kwargs : variables à interpoler ex: requested=3, available=8

    Exemple :
        t("errors.weight_exceeds_capacity", lang="fr", requested=3, available=8)
        → "Poids demandé (3kg) supérieur au disponible (8kg)"
    """
    translations = load_translations(lang)
    keys = key.split(".")
    value = translations
    for k in keys:
        if not isinstance(value, dict) or k not in value:
            # Clé introuvable — retourne la clé brute plutôt que planter
            return key
        value = value[k]
    if kwargs and isinstance(value, str):
        value = value.format(**kwargs)
    return value
