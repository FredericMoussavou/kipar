import pytest
import json
from httpx import AsyncClient
from app.main import app
from app.core.deps import get_current_user
from app.core.config import settings

# On indique à pytest que tous les tests de ce fichier sont asynchrones
pytestmark = pytest.mark.asyncio

# Fixture pour simuler un utilisateur connecté et bypasser le 401
@pytest.fixture
def mock_user_auth():
    # On remplace la dépendance par une fonction qui renvoie un objet factice
    app.dependency_overrides[get_current_user] = lambda: "dummy_authenticated_user"
    yield
    # On nettoie après le test pour ne pas impacter le reste de la suite de tests
    app.dependency_overrides.clear()


# =====================================================================
# 1. TESTS DE PROTECTION CONTRE LES PAYLOAD DoS (Champs trop grands)
# =====================================================================

async def test_register_password_too_long_raises_422(client: AsyncClient):
    """
    ATTACK SIMULATION: Password Hashing DoS.
    La route register est publique, pas besoin de mock_user_auth.
    """
    payload = {
        "email": "hacker@kipar.app",
        "password": "A" * 5000 + "1!aZ",
        "first_name": "Hacker",
        "last_name": "DoS",
        "cgu_accepted": True
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert "password" in response.text


async def test_trip_creation_city_name_too_long_raises_422(client: AsyncClient, mock_user_auth):
    """
    ATTACK SIMULATION: Database/RAM Saturation.
    Utilise 'mock_user_auth' pour passer la barrière du 401 et tester le 422.
    """
    payload = {
        "origin_city": "Paris" * 200, 
        "origin_airport_code": "CDG",
        "destination_city": "Dakar",
        "destination_airport_code": "DSS",
        "departure_date": "2026-12-25",
        "total_kg": 10.0,
        "price_per_kg": 5.0
    }
    response = await client.post("/api/v1/trips", json=payload)
    assert response.status_code == 422


# =====================================================================
# 2. TESTS DE SÉCURITÉ DES WEBHOOKS (Signature Spoofing)
# =====================================================================

async def test_kyc_webhook_missing_signature_raises_400(client: AsyncClient, monkeypatch):
    """
    ATTACK SIMULATION: Webhook Bypass.
    """
    monkeypatch.setattr(settings, "IDENFY_API_KEY", "secure_key_active")
    monkeypatch.setattr(settings, "IDENFY_API_SECRET", "secure_secret_active")

    payload = {"clientId": "manual_12345", "status": "APPROVED"}
    response = await client.post("/api/v1/kyc/webhook", json=payload)
    assert response.status_code == 400


async def test_kyc_webhook_invalid_signature_raises_400(client: AsyncClient, monkeypatch):
    """
    ATTACK SIMULATION: Signature Falsification.
    """
    monkeypatch.setattr(settings, "IDENFY_API_KEY", "secure_key_active")
    monkeypatch.setattr(settings, "IDENFY_API_SECRET", "secure_secret_active")

    payload = {"clientId": "manual_12345", "status": "APPROVED"}
    headers = {"Idenfy-Signature": "fake_computed_hmac_sha256_hash"}
    
    response = await client.post("/api/v1/kyc/webhook", json=payload, headers=headers)
    assert response.status_code == 400


# =====================================================================
# 3. TESTS DE COHÉRENCE DES ENTRÉES STRUCTURELLES (Mots clés / Littéraux)
# =====================================================================

async def test_trip_creation_invalid_currency_raises_422(client: AsyncClient, mock_user_auth):
    """
    ATTACK SIMULATION: Logic Manipulation.
    """
    payload = {
        "origin_city": "Paris",
        "origin_airport_code": "CDG",
        "destination_city": "Abidjan",
        "destination_airport_code": "ABJ",
        "departure_date": "2026-12-25",
        "total_kg": 15.0,
        "price_per_kg": 6.0,
        "currency": "BITCOIN_OR_INJECTION_HERE"
    }
    response = await client.post("/api/v1/trips", json=payload)
    assert response.status_code == 422
