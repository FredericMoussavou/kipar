from fastapi import Depends
from app.core.deps import get_current_user
from app.models.user import User
from app.i18n.loader import DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES


def get_lang(current_user: User = Depends(get_current_user)) -> str:
    """
    Retourne la langue de l'utilisateur connecté.
    Fallback sur 'fr' si la langue n'est pas supportée.
    """
    lang = getattr(current_user, "language", DEFAULT_LANGUAGE)
    return lang if lang in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def get_lang_optional() -> str:
    """
    Pour les endpoints publics sans authentification.
    Retourne toujours 'fr' par défaut.
    """
    return DEFAULT_LANGUAGE
