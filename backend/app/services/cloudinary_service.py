"""
Service Cloudinary — génération de signatures pour upload sécurisé depuis le frontend.
"""
import time
import base64
import logging
import hashlib
import uuid as uuid_module
from typing import Any

import cloudinary
from cloudinary import utils as cloudinary_utils
from app.core.config import settings

logger = logging.getLogger(__name__)


def _ensure_configured() -> None:
    if not settings.CLOUDINARY_CLOUD_NAME:
        raise RuntimeError("Cloudinary non configuré : CLOUDINARY_CLOUD_NAME manquant")
    if not settings.CLOUDINARY_API_KEY:
        raise RuntimeError("Cloudinary non configuré : CLOUDINARY_API_KEY manquant")
    if not settings.CLOUDINARY_API_SECRET:
        raise RuntimeError("Cloudinary non configuré : CLOUDINARY_API_SECRET manquant")


def _configure() -> None:
    _ensure_configured()
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def generate_avatar_upload_signature(user_id: uuid_module.UUID) -> dict[str, Any]:
    """Génère une signature pour l'avatar (Public)."""
    _configure()
    timestamp = int(time.time())
    folder = f"kipar/avatars/{user_id}"
    public_id = f"avatar_{user_id}"

    params_to_sign = {
        "folder": folder,
        "overwrite": "true",
        "public_id": public_id,
        "timestamp": timestamp,
        "upload_preset": settings.CLOUDINARY_UPLOAD_PRESET,
    }

    signature = cloudinary_utils.api_sign_request(params_to_sign, settings.CLOUDINARY_API_SECRET)
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
    if not url or not isinstance(url, str):
        return False
    expected_host = f"res.cloudinary.com/{settings.CLOUDINARY_CLOUD_NAME}/"
    expected_folder = f"kipar/avatars/{user_id}/"
    return expected_host in url and expected_folder in url


def generate_evidence_upload_signature(booking_id: uuid_module.UUID, file_index: int) -> dict[str, Any]:
    """Genere une signature PRIVÉE pour uploader une preuve d'annulation."""
    _configure()

    if file_index < 0 or file_index > 4:
        raise ValueError("file_index doit etre entre 0 et 4")

    timestamp = int(time.time())
    folder = f"kipar/cancellation_evidence/{booking_id}"
    public_id = f"evidence_{booking_id}_{file_index}"

    # AJOUT DE TYPE PRIVATE : Empêche l'accès via URL standard Cloudinary
    params_to_sign = {
        "folder": folder,
        "overwrite": "true",
        "public_id": public_id,
        "resource_type": "auto",
        "timestamp": timestamp,
        "type": "private", 
        "upload_preset": settings.CLOUDINARY_UPLOAD_PRESET,
    }

    signature = cloudinary_utils.api_sign_request(params_to_sign, settings.CLOUDINARY_API_SECRET)

    return {
        "signature": signature,
        "timestamp": timestamp,
        "api_key": settings.CLOUDINARY_API_KEY,
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "folder": folder,
        "public_id": public_id,
        "upload_preset": settings.CLOUDINARY_UPLOAD_PRESET,
        "resource_type": "auto",
        "type": "private",
    }


def generate_kyc_upload_signature(user_id: uuid_module.UUID, doc_type: str) -> dict[str, Any]:
    """
    Génère une signature PRIVÉE impérative pour les pièces d'identité (id_front, id_back, selfie).
    """
    _configure()
    if doc_type not in ("id_front", "id_back", "selfie"):
        raise ValueError("doc_type invalide")

    timestamp = int(time.time())
    folder = f"kipar/kyc/{user_id}"
    public_id = f"kyc_{doc_type}_{user_id}"

    params_to_sign = {
        "folder": folder,
        "overwrite": "true",
        "public_id": public_id,
        "timestamp": timestamp,
        "type": "private",  # Sécurisation maximale RGPD
        "upload_preset": settings.CLOUDINARY_UPLOAD_PRESET,
    }

    signature = cloudinary_utils.api_sign_request(params_to_sign, settings.CLOUDINARY_API_SECRET)

    return {
        "signature": signature,
        "timestamp": timestamp,
        "api_key": settings.CLOUDINARY_API_KEY,
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME,
        "folder": folder,
        "public_id": public_id,
        "upload_preset": settings.CLOUDINARY_UPLOAD_PRESET,
        "type": "private",
    }


def delete_avatar(user_id: uuid_module.UUID) -> None:
    _configure()
    public_id = f"kipar/avatars/{user_id}/avatar_{user_id}"
    try:
        from cloudinary.uploader import destroy
        destroy(public_id, invalidate=True)
    except Exception:
        pass
