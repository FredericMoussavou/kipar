"""Tests des endpoints publics de profil et de listing d'avis."""
import pytest
from httpx import AsyncClient


# Helpers

async def register_and_login(client: AsyncClient, email: str, password: str = "Test123!!"):
    """Inscrit un utilisateur et retourne {id, token, email}."""
    res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Jean",
            "last_name": "Dupont",
        },
    )
    assert res.status_code in (200, 201), f"Register failed: {res.status_code} {res.text}"
    data = res.json()
    token = data["access_token"]

    me_res = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200, f"/users/me failed: {me_res.status_code} {me_res.text}"
    me_data = me_res.json()

    return {
        "id": me_data["id"],
        "token": token,
        "email": email,
    }


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# Tests : GET /users/{id}

@pytest.mark.asyncio
async def test_get_public_profile_ok(client: AsyncClient):
    """Profil public accessible avec auth, contient les champs metier attendus."""
    me = await register_and_login(client, "alice_pub@kipar.com")

    res = await client.get(f"/api/v1/users/{me['id']}", headers=auth_headers(me["token"]))
    assert res.status_code == 200, res.text

    data = res.json()
    assert data["id"] == me["id"]
    assert data["first_name"] == "Jean"
    assert data["last_name"] == "Dupont"
    assert "trust_score" in data
    assert "kyc_status" in data
    assert "is_carrier" in data
    assert "created_at" in data
    assert "avatar_url" in data
    assert data["deliveries_as_sender"] == 0
    assert data["deliveries_as_carrier"] == 0
    assert data["trips_count"] == 0
    assert data["reviews_count"] == 0
    assert data["avg_rating"] is None


@pytest.mark.asyncio
async def test_get_public_profile_no_private_fields(client: AsyncClient):
    """Aucune donnee sensible exposee par l'endpoint public."""
    me = await register_and_login(client, "bob_pub@kipar.com")

    res = await client.get(f"/api/v1/users/{me['id']}", headers=auth_headers(me["token"]))
    assert res.status_code == 200

    data = res.json()
    forbidden = [
        "email",
        "phone",
        "hashed_password",
        "language",
        "fcm_token",
        "stripe_account_id",
        "flutterwave_account_id",
        "google_id",
        "apple_id",
        "onfido_applicant_id",
        "is_superuser",
        "is_active",
    ]
    for field in forbidden:
        assert field not in data, f"Champ prive expose : {field}"


@pytest.mark.asyncio
async def test_get_public_profile_not_found(client: AsyncClient):
    """404 si UUID inexistant."""
    me = await register_and_login(client, "charlie_pub@kipar.com")

    fake_id = "00000000-0000-0000-0000-000000000000"
    res = await client.get(f"/api/v1/users/{fake_id}", headers=auth_headers(me["token"]))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_get_public_profile_requires_auth(client: AsyncClient):
    """401 sans token JWT."""
    me = await register_and_login(client, "dora_pub@kipar.com")

    res = await client.get(f"/api/v1/users/{me['id']}")
    assert res.status_code == 401


# Tests : GET /reviews/user/{id}

@pytest.mark.asyncio
async def test_list_user_reviews_empty(client: AsyncClient):
    """Liste vide si l'utilisateur n'a aucun avis."""
    me = await register_and_login(client, "eve_pub@kipar.com")

    res = await client.get(
        f"/api/v1/reviews/user/{me['id']}",
        headers=auth_headers(me["token"]),
    )
    assert res.status_code == 200, res.text

    data = res.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["avg_score"] is None