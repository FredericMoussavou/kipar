async def test_google_login_new_user(client):
    """Google OAuth crée un nouveau compte si l'email n'existe pas."""
    res = await client.post("/api/v1/auth/google", json={
        "id_token": "simulated_google_token"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["is_new_user"] is True


async def test_google_login_existing_user(client):
    """Google OAuth retrouve un compte existant sur le même email."""
    # Premier appel — crée le compte
    await client.post("/api/v1/auth/google", json={
        "id_token": "simulated_google_token"
    })
    # Deuxième appel — retrouve le compte
    res = await client.post("/api/v1/auth/google", json={
        "id_token": "simulated_google_token"
    })
    assert res.status_code == 200
    assert res.json()["is_new_user"] is False


async def test_google_login_returns_valid_token(client):
    """Le token retourné par Google OAuth est utilisable."""
    res = await client.post("/api/v1/auth/google", json={
        "id_token": "simulated_google_token"
    })
    token = res.json()["access_token"]

    # Utilise le token pour accéder à un endpoint protégé
    me = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "sim_google@kipar.com"


async def test_apple_login_new_user(client):
    """Apple OAuth crée un nouveau compte si l'email n'existe pas."""
    res = await client.post("/api/v1/auth/apple", json={
        "id_token": "simulated_apple_token"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["is_new_user"] is True


async def test_apple_login_existing_user(client):
    """Apple OAuth retrouve un compte existant."""
    await client.post("/api/v1/auth/apple", json={
        "id_token": "simulated_apple_token"
    })
    res = await client.post("/api/v1/auth/apple", json={
        "id_token": "simulated_apple_token"
    })
    assert res.status_code == 200
    assert res.json()["is_new_user"] is False


async def test_apple_login_returns_valid_token(client):
    """Le token retourné par Apple OAuth est utilisable."""
    res = await client.post("/api/v1/auth/apple", json={
        "id_token": "simulated_apple_token"
    })
    token = res.json()["access_token"]

    me = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "sim_apple@kipar.com"


async def test_google_with_name(client):
    """Google OAuth accepte un prénom/nom passé explicitement."""
    res = await client.post("/api/v1/auth/google", json={
        "id_token": "simulated_google_token",
        "first_name": "Frederic",
        "last_name": "Dupont"
    })
    assert res.status_code == 200


async def test_oauth_link_existing_email(client):
    """Un compte email existant est lié au provider OAuth sans duplication."""
    VALID_PASSWORD = "Kipar@2025"

    # Crée un compte classique
    await client.post("/api/v1/auth/register", json={
        "email": "sim_google@kipar.com",
        "password": VALID_PASSWORD,
        "first_name": "Test",
        "last_name": "User"
    })

    # Connexion Google avec le même email — doit retrouver le compte
    res = await client.post("/api/v1/auth/google", json={
        "id_token": "simulated_google_token"
    })
    assert res.status_code == 200
    assert res.json()["is_new_user"] is False
