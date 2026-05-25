from datetime import date, timedelta
from sqlalchemy import update
from app.models.user import User

VALID_PASSWORD = "Kipar@2025"
TOMORROW = str(date.today() + timedelta(days=8))


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
        update(User).where(User.email == email).values(kyc_status="approved")
    )
    await db_session.flush()
    res = await client.post("/api/v1/auth/login", json={
        "email": email, "password": VALID_PASSWORD
    })
    return res.json()["access_token"]


async def setup_accepted_booking(client, db_session):
    """Crée un trajet, une réservation et l'accepte — retourne booking_id et tokens."""
    carrier_token = await make_verified_carrier(client, db_session, "carrier_m@kipar.com")
    sender_token = await register_and_login(client, "sender_m@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": "receiver_m@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres",
        "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    booking_id = booking.json()["id"]
    await client.patch(
        f"/api/v1/bookings/{booking_id}/accept",
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    return booking_id, sender_token, carrier_token


async def test_create_conversation(client, db_session):
    """Crée une conversation sur une réservation acceptée."""
    booking_id, sender_token, _ = await setup_accepted_booking(client, db_session)
    res = await client.post(
        f"/api/v1/conversations/{booking_id}",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 201
    assert res.json()["booking_id"] == booking_id


async def test_create_conversation_not_accepted(client, db_session):
    """Impossible de créer une conversation sur une réservation pending."""
    carrier_token = await make_verified_carrier(
        client, db_session, "carrier_m2@kipar.com"
    )
    sender_token = await register_and_login(client, "sender_m2@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": "receiver@kipar.com",
        "weight_kg": 3.0, "content_description": "Test",
        "declared_value": 10.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    res = await client.post(
        f"/api/v1/conversations/{booking.json()['id']}",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 400


async def test_get_conversation(client, db_session):
    """Récupère l'historique d'une conversation."""
    booking_id, sender_token, _ = await setup_accepted_booking(
        client, db_session
    )
    # Crée d'abord la conversation
    conv = await client.post(
        f"/api/v1/conversations/{booking_id}",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    conv_id = conv.json()["id"]

    res = await client.get(
        f"/api/v1/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200
    assert "messages" in res.json()
