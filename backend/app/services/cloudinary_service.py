"""
Service Cloudinary — génération de signatures pour upload sécurisé depuis le frontend.

Flux signed upload :
  1. Frontend POST /users/me/avatar/sign → reçoit { signature, timestamp, ... }
  2. Frontend POST direct vers Cloudinary avec ces params
  3. Cloudinary valide et retourne l'URL publique
  4. Frontend PATCH /users/me/avatar avec l'URL pour la persister en BDD

L'API_SECRET ne quitte jamais le backend.
"""
import time
import hashlib
import uuid as uuid_module
from typing import Any

import cloudinary
from cloudinary import utils as cloudinary_utils

from app.core.config import settings


def _ensure_configured() -> None:
    """Vérifie que les credentials Cloudinary sont présents avant tout appel."""
    if not settings.CLOUDINARY_CLOUD_NAME:
        raise RuntimeError(
            "Cloudinary non configuré : CLOUDINARY_CLOUD_NAME manquant dans .env"
        )
    if not settings.CLOUDINARY_API_KEY:
        raise RuntimeError(
            "Cloudinary non configuré : CLOUDINARY_API_KEY manquant dans .env"
        )
    if not settings.CLOUDINARY_API_SECRET:
        raise RuntimeError(
            "Cloudinary non configuré : CLOUDINARY_API_SECRET manquant dans .env"
        )


def _configure() -> None:
    """Initialise le SDK cloudinary avec nos credentials (idempotent)."""
    _ensure_configured()
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def generate_avatar_upload_signature(user_id: uuid_module.UUID) -> dict[str, Any]:
    """
    Génère une signature pour autoriser le frontend à uploader un avatar.

    L'utilisateur ne peut uploader que dans le folder `kipar/avatars/{user_id}/`
    avec un public_id basé sur son user_id (overwrite=True remplace l'ancien).

    Args:
        user_id: UUID de l'utilisateur qui upload son avatar

    Returns:
        dict avec timestamp, signature, api_key, cloud_name, folder, public_id, upload_preset
        (le frontend renvoie tout ça à Cloudinary lors de l'upload)
    """
    _configure()

    timestamp = int(time.time())
    folder = f"kipar/avatars/{user_id}"
    public_id = f"avatar_{user_id}"  # même public_id à chaque upload = remplace l'ancien

    # Paramètres signés (DOIVENT être dans l'ordre alphabétique pour la signature)
    params_to_sign = {
        "folder": folder,
        "overwrite": "true",
        "public_id": public_id,
        "timestamp": timestamp,
        "upload_preset": settings.CLOUDINARY_UPLOAD_PRESET,
    }

    signature = cloudinary_utils.api_sign_request(
        params_to_sign,
        settings.CLOUDINARY_API_SECRET,
    )

    return {
        "signature": signature,
        "timestamp": timestamp,
        "api_key": settings.CLOUDINARY_API_KEY,
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "folder": folder,
        "public_id": public_id,
        "upload_preset": settings.CLOUDINARY_UPLOAD_PRESET,
    }


def validate_avatar_url(url: str, user_id: uuid_module.UUID) -> bool:
    """
    Valide qu'une URL d'avatar appartient bien à notre compte Cloudinary
    et au folder de l'utilisateur (anti-spoofing).

    Évite qu'un user malveillant n'enregistre comme son avatar une URL
    pointant vers un autre compte ou vers un autre user.

    Args:
        url: URL retournée par Cloudinary après upload
        user_id: UUID de l'utilisateur qui prétend être propriétaire

    Returns:
        True si l'URL est valide pour cet utilisateur
    """
    if not url or not isinstance(url, str):
        return False

    expected_host = f"res.cloudinary.com/{settings.CLOUDINARY_CLOUD_NAME}/"
    expected_folder = f"kipar/avatars/{user_id}/"

    return expected_host in url and expected_folder in url


def delete_avatar(user_id: uuid_module.UUID) -> None:
    """
    Supprime l'avatar d'un utilisateur dans Cloudinary.
    Silencieux si le fichier n'existe pas (idempotent).
    """
    _configure()

    public_id = f"kipar/avatars/{user_id}/avatar_{user_id}"
    try:
        from cloudinary.uploader import destroy
        destroy(public_id, invalidate=True)
    except Exception:
        # On ne fait pas planter l'app si la suppression Cloudinary échoue
        # (l'avatar reste référencé en BDD jusqu'au prochain upload qui le remplacera)
        pass