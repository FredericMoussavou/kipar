from sqlalchemy import update
from app.models.user import User

VALID_PASSWORD = "Kipar@2025"


async def register_and_login(client, email: str) -> str:
    await client.post("/api/v1/auth/register", json={
        "email": email, "password": VALID_PASSWORD,
        "first_name": "Test", "last_name": "User"
    })
    res = await client.post("/api/v1/auth/login", json={
        "email": email, "password": VALID_PASSWORD
    })
    return res.json()["access_token"]


async def test_kyc_init(client, db_session):
    """Démarre le processus KYC — retourne un SDK token simulé."""
    token = await register_and_login(client, "kyc1@kipar.com")
    res = await client.post(
        "/api/v1/kyc/init",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "verification_url" in data
    assert "scan_ref" in data
    assert "applicant_id" in data


async def test_kyc_already_verified(client, db_session):
    """Impossible de relancer le KYC si déjà vérifié."""
    token = await register_and_login(client, "kyc2@kipar.com")
    await db_session.execute(
        update(User).where(User.email == "kyc2@kipar.com")
        .values(kyc_status="verified")
    )
    await db_session.flush()
    res = await client.post(
        "/api/v1/kyc/init",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 400


async def test_kyc_simulate_verify(client, db_session):
    """Simule la vérification KYC en dev."""
    token = await register_and_login(client, "kyc3@kipar.com")
    res = await client.post(
        "/api/v1/kyc/simulate-verify",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert res.json()["kyc_status"] == "verified"
    assert "trust_score" in res.json()


async def test_trust_score_increases_with_kyc(client, db_session):
    """Le score KiparTrust augmente après KYC vérifié."""
    token = await register_and_login(client, "kyc4@kipar.com")

    # Score initial
    me = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    initial_score = me.json()["trust_score"]

    # Vérifie le KYC
    await client.post(
        "/api/v1/kyc/simulate-verify",
        headers={"Authorization": f"Bearer {token}"}
    )

    # Score après KYC
    me = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me.json()["trust_score"] > initial_score
