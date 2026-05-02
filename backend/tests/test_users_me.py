"""Tests des endpoints du profil personnel /users/me."""
import pytest
from httpx import AsyncClient


# ─── Helpers ────────────────────────────────────────────────────────────────

async def register_and_login(
    client: AsyncClient,
    email: str,
    password: str = "Test123!!",
    first_name: str = "Jean",
    last_name: str = "Dupont",
):
    """Inscrit un user et retourne {id, token, email, password}."""
    res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": first_name,
            "last_name": last_name,
        },
    )
    assert res.status_code in (200, 201), f"Register failed: {res.status_code} {res.text}"
    token = res.json()["access_token"]

    me_res = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    return {
        "id": me_res.json()["id"],
        "token": token,
        "email": email,
        "password": password,
    }


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── PATCH /me — telephone ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_phone_ok(client: AsyncClient):
    """Mise a jour du telephone reussit."""
    me = await register_and_login(client, "phone1@kipar.com")

    res = await client.patch(
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
        json={"phone": "+33611111101"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["phone"] == "+33611111101"


@pytest.mark.asyncio
async def test_update_phone_empty_clears_value(client: AsyncClient):
    """Une chaine vide efface le numero."""
    me = await register_and_login(client, "phone2@kipar.com")

    # On met un numero
    await client.patch(
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
        json={"phone": "+33611111102"},
    )

    # Puis on l'efface
    res = await client.patch(
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
        json={"phone": ""},
    )
    assert res.status_code == 200
    assert res.json()["user"]["phone"] is None


@pytest.mark.asyncio
async def test_update_phone_invalid_format(client: AsyncClient):
    """Un format invalide est rejete par Pydantic (422)."""
    me = await register_and_login(client, "phone3@kipar.com")

    res = await client.patch(
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
        json={"phone": "abc-not-a-phone"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_update_phone_already_used(client: AsyncClient):
    """Un numero deja pris par un autre user renvoie 409."""
    user1 = await register_and_login(client, "phone4a@kipar.com")
    user2 = await register_and_login(client, "phone4b@kipar.com")

    # User1 prend un numero
    await client.patch(
        "/api/v1/users/me",
        headers=auth_headers(user1["token"]),
        json={"phone": "+33611111104"},
    )

    # User2 essaie de prendre le meme
    res = await client.patch(
        "/api/v1/users/me",
        headers=auth_headers(user2["token"]),
        json={"phone": "+33611111104"},
    )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_update_phone_same_as_current_is_noop(client: AsyncClient):
    """Reposter son propre numero ne renvoie pas 409 (no-op)."""
    me = await register_and_login(client, "phone5@kipar.com")

    await client.patch(
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
        json={"phone": "+33611111105"},
    )
    # Re-poster le meme
    res = await client.patch(
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
        json={"phone": "+33611111105"},
    )
    assert res.status_code == 200
    assert res.json()["user"]["phone"] == "+33611111105"


# ─── POST /me/avatar/sign — signature Cloudinary ────────────────────────────

@pytest.mark.asyncio
async def test_avatar_signature_ok(client: AsyncClient):
    """La signature contient les champs attendus."""
    me = await register_and_login(client, "avatar1@kipar.com")

    res = await client.post(
        "/api/v1/users/me/avatar/sign",
        headers=auth_headers(me["token"]),
    )
    assert res.status_code == 200
    data = res.json()
    assert "signature" in data
    assert "timestamp" in data
    assert "api_key" in data
    assert "cloud_name" in data
    assert "folder" in data
    assert "public_id" in data
    assert "upload_preset" in data
    # Securite : le folder contient l'user_id
    assert me["id"] in data["folder"]


@pytest.mark.asyncio
async def test_avatar_signature_requires_auth(client: AsyncClient):
    """401 sans token."""
    res = await client.post("/api/v1/users/me/avatar/sign")
    assert res.status_code == 401


# ─── PATCH /me/avatar — validation URL ──────────────────────────────────────

@pytest.mark.asyncio
async def test_update_avatar_with_valid_url(client: AsyncClient):
    """Une URL Cloudinary valide pour cet user est acceptee."""
    me = await register_and_login(client, "avatar2@kipar.com")

    # On simule une URL Cloudinary plausible
    valid_url = (
        f"https://res.cloudinary.com/dzlhxae2z/image/upload/v123456/"
        f"kipar/avatars/{me['id']}/avatar_{me['id']}.jpg"
    )
    res = await client.patch(
        "/api/v1/users/me/avatar",
        headers=auth_headers(me["token"]),
        json={"avatar_url": valid_url},
    )
    assert res.status_code == 200
    assert res.json()["avatar_url"] == valid_url


@pytest.mark.asyncio
async def test_update_avatar_with_url_from_another_user(client: AsyncClient):
    """Une URL pointant vers un autre user est rejetee (anti-spoofing)."""
    me = await register_and_login(client, "avatar3@kipar.com")
    other = await register_and_login(client, "avatar4@kipar.com")

    other_url = (
        f"https://res.cloudinary.com/dzlhxae2z/image/upload/v123456/"
        f"kipar/avatars/{other['id']}/avatar_{other['id']}.jpg"
    )
    res = await client.patch(
        "/api/v1/users/me/avatar",
        headers=auth_headers(me["token"]),
        json={"avatar_url": other_url},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_update_avatar_with_external_url(client: AsyncClient):
    """Une URL hors Cloudinary est rejetee."""
    me = await register_and_login(client, "avatar5@kipar.com")

    res = await client.patch(
        "/api/v1/users/me/avatar",
        headers=auth_headers(me["token"]),
        json={"avatar_url": "https://malicious.com/avatar.jpg"},
    )
    assert res.status_code == 400


# ─── PATCH /me/notification-preferences ─────────────────────────────────────

@pytest.mark.asyncio
async def test_notifications_default_values(client: AsyncClient):
    """A l'inscription : email=True, push=True, sms=False."""
    me = await register_and_login(client, "notif1@kipar.com")

    res = await client.get(
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
    )
    data = res.json()
    assert data["notify_by_email"] is True
    assert data["notify_by_push"] is True
    assert data["notify_by_sms"] is False


@pytest.mark.asyncio
async def test_update_notifications_partial(client: AsyncClient):
    """On peut mettre a jour un seul champ a la fois."""
    me = await register_and_login(client, "notif2@kipar.com")

    res = await client.patch(
        "/api/v1/users/me/notification-preferences",
        headers=auth_headers(me["token"]),
        json={"notify_by_sms": True},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["notify_by_sms"] is True
    assert data["notify_by_email"] is True
    assert data["notify_by_push"] is True


@pytest.mark.asyncio
async def test_update_notifications_disable_all(client: AsyncClient):
    """On peut tout desactiver d'un coup."""
    me = await register_and_login(client, "notif3@kipar.com")

    res = await client.patch(
        "/api/v1/users/me/notification-preferences",
        headers=auth_headers(me["token"]),
        json={
            "notify_by_email": False,
            "notify_by_push": False,
            "notify_by_sms": False,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["notify_by_email"] is False
    assert data["notify_by_push"] is False
    assert data["notify_by_sms"] is False


# ─── DELETE /me — soft delete + anonymisation ───────────────────────────────

@pytest.mark.asyncio
async def test_delete_account_ok(client: AsyncClient):
    """Suppression reussie avec le bon mot de passe."""
    me = await register_and_login(client, "delete1@kipar.com")

    res = await client.request(
        "DELETE",
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
        json={"password": me["password"]},
    )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_delete_account_wrong_password(client: AsyncClient):
    """Mauvais mot de passe = 403, compte intact."""
    me = await register_and_login(client, "delete2@kipar.com")

    res = await client.request(
        "DELETE",
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
        json={"password": "WrongPass123!!"},
    )
    assert res.status_code == 403

    # Le compte est toujours actif (login fonctionne)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "delete2@kipar.com", "password": "Test123!!"},
    )
    assert login_res.status_code == 200


@pytest.mark.asyncio
async def test_delete_account_then_login_fails(client: AsyncClient):
    """Apres suppression, le login echoue avec 401 (anti-enumeration)."""
    me = await register_and_login(client, "delete3@kipar.com")

    # Suppression
    del_res = await client.request(
        "DELETE",
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
        json={"password": me["password"]},
    )
    assert del_res.status_code == 200

    # Login refuse
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "delete3@kipar.com", "password": me["password"]},
    )
    assert login_res.status_code == 401


@pytest.mark.asyncio
async def test_delete_account_anonymizes_data(client: AsyncClient):
    """Apres suppression, les donnees perso sont anonymisees en BDD."""
    me = await register_and_login(client, "delete4@kipar.com")
    user_id = me["id"]

    await client.request(
        "DELETE",
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
        json={"password": me["password"]},
    )

    # Verification cote BDD via le profil public
    # -> doit retourner 404 car is_active=False
    other = await register_and_login(client, "delete4_voyeur@kipar.com")
    pub_res = await client.get(
        f"/api/v1/users/{user_id}",
        headers=auth_headers(other["token"]),
    )
    assert pub_res.status_code == 404


@pytest.mark.asyncio
async def test_delete_account_can_reregister_same_email(client: AsyncClient):
    """L'email originel devient libre (anonymisation effectuee)."""
    me = await register_and_login(client, "delete5@kipar.com")

    await client.request(
        "DELETE",
        "/api/v1/users/me",
        headers=auth_headers(me["token"]),
        json={"password": me["password"]},
    )

    # Reinscription avec le meme email
    res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "delete5@kipar.com",
            "password": "NewPass456!!",
            "first_name": "Nouveau",
            "last_name": "Compte",
        },
    )
    assert res.status_code in (200, 201), f"Re-register failed: {res.text}"