import pytest
import pyotp

VALID_PASSWORD = "Kipar@2025"
BASE = "/api/v1"


async def _register_and_login(client, email="totp@kipar.com"):
    await client.post(f"{BASE}/auth/register", json={
        "email": email,
        "password": VALID_PASSWORD,
        "first_name": "Test",
        "last_name": "TOTP",
    })
    res = await client.post(f"{BASE}/auth/login", json={
        "email": email,
        "password": VALID_PASSWORD,
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_setup_totp(client):
    headers = await _register_and_login(client)
    res = await client.post(f"{BASE}/auth/2fa/setup", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "qr_code" in data
    assert "secret" in data
    assert len(data["secret"]) > 10


async def test_setup_totp_idempotent(client):
    """Appeler /setup deux fois retourne le meme secret."""
    headers = await _register_and_login(client, "totp2@kipar.com")
    res1 = await client.post(f"{BASE}/auth/2fa/setup", headers=headers)
    res2 = await client.post(f"{BASE}/auth/2fa/setup", headers=headers)
    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()["secret"] == res2.json()["secret"]


async def test_verify_setup_valid_code(client):
    headers = await _register_and_login(client, "totp3@kipar.com")
    res = await client.post(f"{BASE}/auth/2fa/setup", headers=headers)
    secret = res.json()["secret"]
    code = pyotp.TOTP(secret).now()
    res2 = await client.post(f"{BASE}/auth/2fa/verify-setup", json={"code": code}, headers=headers)
    assert res2.status_code == 200
    assert res2.json()["status"] == "enabled"


async def test_verify_setup_invalid_code(client):
    headers = await _register_and_login(client, "totp4@kipar.com")
    await client.post(f"{BASE}/auth/2fa/setup", headers=headers)
    res = await client.post(f"{BASE}/auth/2fa/verify-setup", json={"code": "000000"}, headers=headers)
    assert res.status_code == 400


async def test_verify_setup_wrong_secret_fails(client):
    """Simule le bug : secret different en DB vs QR affiche."""
    headers = await _register_and_login(client, "totp5@kipar.com")
    await client.post(f"{BASE}/auth/2fa/setup", headers=headers)
    # Genere un code avec un secret aleatoire different
    wrong_secret = pyotp.random_base32()
    wrong_code = pyotp.TOTP(wrong_secret).now()
    res = await client.post(f"{BASE}/auth/2fa/verify-setup", json={"code": wrong_code}, headers=headers)
    assert res.status_code == 400


async def test_disable_totp(client):
    headers = await _register_and_login(client, "totp6@kipar.com")
    res = await client.post(f"{BASE}/auth/2fa/setup", headers=headers)
    secret = res.json()["secret"]
    code = pyotp.TOTP(secret).now()
    await client.post(f"{BASE}/auth/2fa/verify-setup", json={"code": code}, headers=headers)
    code2 = pyotp.TOTP(secret).now()
    res2 = await client.post(f"{BASE}/auth/2fa/disable", json={"code": code2}, headers=headers)
    assert res2.status_code == 200
    assert res2.json()["status"] == "disabled"


async def test_disable_totp_invalid_code(client):
    headers = await _register_and_login(client, "totp7@kipar.com")
    res = await client.post(f"{BASE}/auth/2fa/setup", headers=headers)
    secret = res.json()["secret"]
    code = pyotp.TOTP(secret).now()
    await client.post(f"{BASE}/auth/2fa/verify-setup", json={"code": code}, headers=headers)
    res2 = await client.post(f"{BASE}/auth/2fa/disable", json={"code": "000000"}, headers=headers)
    assert res2.status_code == 400


async def test_setup_already_enabled(client):
    headers = await _register_and_login(client, "totp8@kipar.com")
    res = await client.post(f"{BASE}/auth/2fa/setup", headers=headers)
    secret = res.json()["secret"]
    code = pyotp.TOTP(secret).now()
    await client.post(f"{BASE}/auth/2fa/verify-setup", json={"code": code}, headers=headers)
    res2 = await client.post(f"{BASE}/auth/2fa/setup", headers=headers)
    assert res2.status_code == 400
