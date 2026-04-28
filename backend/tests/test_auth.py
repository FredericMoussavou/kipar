import pytest

VALID_PASSWORD = "Kipar@2025"  # respecte toutes les règles


async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_register(client):
    response = await client.post("/api/v1/auth/register", json={
        "email": "test@kipar.com",
        "password": VALID_PASSWORD,
        "first_name": "Test",
        "last_name": "User"
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_register_duplicate_email(client):
    payload = {
        "email": "duplicate@kipar.com",
        "password": VALID_PASSWORD,
        "first_name": "Test",
        "last_name": "User"
    }
    await client.post("/api/v1/auth/register", json=payload)
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400


async def test_register_weak_password(client):
    response = await client.post("/api/v1/auth/register", json={
        "email": "weak@kipar.com",
        "password": "toofaible",
        "first_name": "Test",
        "last_name": "User"
    })
    assert response.status_code == 422


async def test_login(client):
    await client.post("/api/v1/auth/register", json={
        "email": "login@kipar.com",
        "password": VALID_PASSWORD,
        "first_name": "Test",
        "last_name": "User"
    })
    response = await client.post("/api/v1/auth/login", json={
        "email": "login@kipar.com",
        "password": VALID_PASSWORD
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


async def test_login_wrong_password(client):
    await client.post("/api/v1/auth/register", json={
        "email": "wrong@kipar.com",
        "password": VALID_PASSWORD,
        "first_name": "Test",
        "last_name": "User"
    })
    response = await client.post("/api/v1/auth/login", json={
        "email": "wrong@kipar.com",
        "password": "MauvaisMotDePasse@1"
    })
    assert response.status_code == 401


async def test_refresh_token(client):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "refresh@kipar.com",
        "password": VALID_PASSWORD,
        "first_name": "Test",
        "last_name": "User"
    })
    refresh_token = reg.json()["refresh_token"]
    response = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token
    })
    assert response.status_code == 200
    assert "access_token" in response.json()
