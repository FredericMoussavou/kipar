from datetime import date, timedelta
from sqlalchemy import update, select
from app.models.user import User
from app.models.booking import Booking
from app.models.package import Package
import io

VALID_PASSWORD = "Kipar@2025"
TOMORROW = str(date.today() + timedelta(days=1))


async def register_and_login(client, email: str) -> str:
    await client.post("/api/v1/auth/register", json={
        "email": email, "password": VALID_PASSWORD,
        "first_name": "Test", "last_name": "User"
    })
    res = await client.post("/api/v1/auth/login", json={
        "email": email, "password": VALID_PASSWORD
    })
    return res.json()["access_token"]


async def make_verified_carrier(client, db_session, email: str) -> str:
    await register_and_login(client, email)
    await db_session.execute(
        update(User).where(User.email == email).values(kyc_status="verified")
    )
    await db_session.flush()
    res = await client.post("/api/v1/auth/login", json={
        "email": email, "password": VALID_PASSWORD
    })
    return res.json()["access_token"]


async def create_package_via_booking(client, db_session, suffix: str) -> tuple:
    """Crée une réservation et retourne le package_id et le token expéditeur."""
    carrier_token = await make_verified_carrier(
        client, db_session, f"carrier_ks{suffix}@kipar.com"
    )
    sender_token = await register_and_login(client, f"sender_ks{suffix}@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": f"receiver_ks{suffix}@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres",
        "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    booking_id = booking.json()["id"]

    # Récupère le package_id
    result = await db_session.execute(
        select(Booking).where(Booking.id == booking_id)
    )
    b = result.scalar_one()
    return str(b.package_id), sender_token


async def test_kiparscan_simulation(client, db_session):
    """KiparScan retourne un résultat simulé si pas de clé OpenAI."""
    package_id, sender_token = await create_package_via_booking(client, db_session, "1")

    # Crée une fausse image JPEG
    fake_image = io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 100)

    res = await client.post(
        f"/api/v1/kiparscan/{package_id}",
        files={"file": ("test.jpg", fake_image, "image/jpeg")},
        params={"destination_country": "SN"},
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "content_description" in data
    assert "prohibited_flag" in data
    assert "confidence" in data
    assert data["simulated"] is True


async def test_kiparscan_updates_package(client, db_session):
    """KiparScan met à jour le flag prohibé sur le Package."""
    package_id, sender_token = await create_package_via_booking(client, db_session, "2")

    fake_image = io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 100)

    await client.post(
        f"/api/v1/kiparscan/{package_id}",
        files={"file": ("test.jpg", fake_image, "image/jpeg")},
        params={"destination_country": "SN"},
        headers={"Authorization": f"Bearer {sender_token}"}
    )

    # Vérifie que le scan_result est sauvegardé en base
    result = await db_session.execute(
        select(Package).where(Package.id == package_id)
    )
    package = result.scalar_one()
    assert package.ai_scan_result is not None
    assert package.ai_prohibited_flag is False


async def test_kiparscan_unauthorized(client, db_session):
    """Un autre utilisateur ne peut pas scanner un colis qui ne lui appartient pas."""
    package_id, _ = await create_package_via_booking(client, db_session, "3")
    other_token = await register_and_login(client, "other_ks3@kipar.com")

    fake_image = io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 100)

    res = await client.post(
        f"/api/v1/kiparscan/{package_id}",
        files={"file": ("test.jpg", fake_image, "image/jpeg")},
        params={"destination_country": "SN"},
        headers={"Authorization": f"Bearer {other_token}"}
    )
    assert res.status_code == 403
