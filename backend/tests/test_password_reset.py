import pytest
from sqlalchemy import select
from app.models.password_reset import PasswordReset
from app.models.user import User

VALID_PASSWORD = "Kipar@2025"
NEW_PASSWORD = "KiparNew@2026"


async def register_and_login(client, email: str) -> dict:
    await client.post("/api/v1/auth/register", json={
        "email": email, "password": VALID_PASSWORD,
        "first_name": "Test", "last_name": "User"
    })
    res = await client.post("/api/v1/auth/login", json={
        "email": email, "password": VALID_PASSWORD
    })
    return res.json()


async def test_forgot_password_known_email(client, db_session):
    """Retourne 200 et crée un token pour un email connu."""
    await client.post("/api/v1/auth/register", json={
        "email": "reset1@kipar.com", "password": VALID_PASSWORD,
        "first_name": "Test", "last_name": "User"
    })
    res = await client.post("/api/v1/auth/forgot-password", json={
        "email": "reset1@kipar.com"
    })
    assert res.status_code == 200
    assert "message" in res.json()

    result = await db_session.execute(
        select(PasswordReset).join(User).where(User.email == "reset1@kipar.com")
    )
    reset = result.scalar_one_or_none()
    assert reset is not None
    assert reset.used is False


async def test_forgot_password_unknown_email(client, db_session):
    """Retourne 200 même pour un email inconnu — anti-énumération."""
    res = await client.post("/api/v1/auth/forgot-password", json={
        "email": "unknown@kipar.com"
    })
    assert res.status_code == 200


async def test_reset_password_valid_token(client, db_session):
    """Réinitialise le mot de passe avec un token valide."""
    await client.post("/api/v1/auth/register", json={
        "email": "reset2@kipar.com", "password": VALID_PASSWORD,
        "first_name": "Test", "last_name": "User"
    })
    await client.post("/api/v1/auth/forgot-password", json={
        "email": "reset2@kipar.com"
    })

    # Récupère le token en base
    result = await db_session.execute(
        select(PasswordReset).join(User).where(User.email == "reset2@kipar.com")
    )
    reset = result.scalar_one()
    token_value = reset.token

    res = await client.post("/api/v1/auth/reset-password", json={
        "token": token_value,
        "new_password": NEW_PASSWORD
    })
    assert res.status_code == 200

# Vérifie que l'ancien mot de passe ne fonctionne plus
    old_login = await client.post("/api/v1/auth/login", json={
        "email": "reset2@kipar.com", "password": VALID_PASSWORD
    })
    assert old_login.status_code == 401

    # Vérifie que le nouveau mot de passe fonctionne
    login = await client.post("/api/v1/auth/login", json={
        "email": "reset2@kipar.com", "password": NEW_PASSWORD
    })
    assert login.status_code == 200


async def test_reset_password_invalid_token(client, db_session):
    """Token invalide → 400."""
    res = await client.post("/api/v1/auth/reset-password", json={
        "token": "token_invalide_xxx",
        "new_password": NEW_PASSWORD
    })
    assert res.status_code == 400


async def test_reset_password_token_used_twice(client, db_session):
    """Un token déjà utilisé → 400."""
    await client.post("/api/v1/auth/register", json={
        "email": "reset3@kipar.com", "password": VALID_PASSWORD,
        "first_name": "Test", "last_name": "User"
    })
    await client.post("/api/v1/auth/forgot-password", json={
        "email": "reset3@kipar.com"
    })

    result = await db_session.execute(
        select(PasswordReset).join(User).where(User.email == "reset3@kipar.com")
    )
    reset = result.scalar_one()

    # Premier reset — OK
    await client.post("/api/v1/auth/reset-password", json={
        "token": reset.token, "new_password": NEW_PASSWORD
    })

    # Deuxième tentative — doit échouer
    res = await client.post("/api/v1/auth/reset-password", json={
        "token": reset.token, "new_password": NEW_PASSWORD
    })
    assert res.status_code == 400


async def test_change_password(client, db_session):
    """L'utilisateur connecté change son mot de passe."""
    data = await register_and_login(client, "change1@kipar.com")
    token = data["access_token"]

    res = await client.post("/api/v1/auth/change-password", json={
        "old_password": VALID_PASSWORD,
        "new_password": NEW_PASSWORD
    }, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200

    login = await client.post("/api/v1/auth/login", json={
        "email": "change1@kipar.com", "password": NEW_PASSWORD
    })
    assert login.status_code == 200


async def test_change_password_wrong_old(client, db_session):
    """Ancien mot de passe incorrect → 400."""
    data = await register_and_login(client, "change2@kipar.com")
    token = data["access_token"]

    res = await client.post("/api/v1/auth/change-password", json={
        "old_password": "MauvaisAncien@1",
        "new_password": NEW_PASSWORD
    }, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 400


async def test_change_password_same_as_old(client, db_session):
    """Nouveau mot de passe identique à l'ancien → 400."""
    data = await register_and_login(client, "change3@kipar.com")
    token = data["access_token"]

    res = await client.post("/api/v1/auth/change-password", json={
        "old_password": VALID_PASSWORD,
        "new_password": VALID_PASSWORD
    }, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 400
