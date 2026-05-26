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


async def test_update_fcm_token(client, db_session):
    """Enregistre un token FCM."""
    token = await register_and_login(client, "fcm1@kipar.com")
    res = await client.patch(
        "/api/v1/users/me/fcm-token",
        json={"fcm_token": "test_fcm_token_abc123"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200


async def test_update_language(client, db_session):
    """Change la langue de l'utilisateur."""
    token = await register_and_login(client, "lang1@kipar.com")
    res = await client.patch(
        "/api/v1/users/me/language",
        json={"language": "en"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert res.json()["language"] == "en"


async def test_update_language_unsupported(client, db_session):
    """Langue non supportée → fallback sur 'fr'."""
    token = await register_and_login(client, "lang2@kipar.com")
    res = await client.patch(
        "/api/v1/users/me/language",
        json={"language": "zh"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert res.json()["language"] == "fr"


async def test_get_me(client, db_session):
    """Retourne le profil de l'utilisateur connecté."""
    token = await register_and_login(client, "me1@kipar.com")
    res = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "me1@kipar.com"
    assert "trust_score" in data
    assert "kyc_status" in data


async def test_booking_triggers_notification(client, db_session):
    """
    Crée une réservation — vérifie que le flux passe sans erreur
    même si Firebase n'est pas configuré (mode simulation).
    """
    carrier_token = await make_verified_carrier(
        client, db_session, "carrier_n1@kipar.com"
    )
    sender_token = await make_verified_carrier(client, db_session, "sender_n1@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    res = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": "receiver_n1@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres",
        "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    assert res.status_code == 201


async def test_accept_booking_triggers_notification(client, db_session):
    """
    Accepte une réservation — vérifie que la notification
    à l'expéditeur passe sans erreur.
    """
    carrier_token = await make_verified_carrier(
        client, db_session, "carrier_n2@kipar.com"
    )
    sender_token = await make_verified_carrier(client, db_session, "sender_n2@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": "receiver_n2@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres",
        "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    res = await client.patch(
        f"/api/v1/bookings/{booking.json()['id']}/accept",
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    assert res.status_code == 200
