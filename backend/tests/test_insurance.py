from datetime import date, timedelta
from sqlalchemy import update, select
from app.models.user import User
from app.models.booking import Booking

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


async def setup_accepted_booking(client, db_session, suffix: str) -> tuple:
    carrier_token = await make_verified_carrier(
        client, db_session, f"carrier_ins{suffix}@kipar.com"
    )
    sender_token = await register_and_login(client, f"sender_ins{suffix}@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": f"receiver_ins{suffix}@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres",
        "declared_value": 200.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    booking_id = booking.json()["id"]
    await client.patch(
        f"/api/v1/bookings/{booking_id}/accept",
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    return booking_id, sender_token


async def test_get_insurance_quote(client, db_session):
    """Retourne un devis d'assurance — prime = 3% de la valeur déclarée."""
    booking_id, sender_token = await setup_accepted_booking(client, db_session, "1")

    res = await client.get(
        f"/api/v1/insurance/quote/{booking_id}",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["declared_value"] == 200.0
    assert data["rate"] == 0.03
    assert data["premium_amount"] == 6.0   # 200 * 3%
    assert data["coverage_amount"] == 200.0


async def test_subscribe_insurance(client, db_session):
    """Souscrit une assurance sur une réservation acceptée."""
    booking_id, sender_token = await setup_accepted_booking(client, db_session, "2")

    res = await client.post(
        "/api/v1/insurance",
        json={"booking_id": booking_id},
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "active"
    assert data["premium_amount"] == 6.0
    assert data["coverage_amount"] == 200.0


async def test_subscribe_insurance_updates_booking(client, db_session):
    """La souscription met à jour insurance_subscribed sur le booking."""
    booking_id, sender_token = await setup_accepted_booking(client, db_session, "3")

    await client.post(
        "/api/v1/insurance",
        json={"booking_id": booking_id},
        headers={"Authorization": f"Bearer {sender_token}"}
    )

    result = await db_session.execute(
        select(Booking).where(Booking.id == booking_id)
    )
    booking = result.scalar_one()
    assert booking.insurance_subscribed is True
    assert booking.insurance_amount == 6.0


async def test_subscribe_insurance_duplicate_fails(client, db_session):
    """Impossible de souscrire deux fois la même assurance."""
    booking_id, sender_token = await setup_accepted_booking(client, db_session, "4")

    await client.post(
        "/api/v1/insurance",
        json={"booking_id": booking_id},
        headers={"Authorization": f"Bearer {sender_token}"}
    )

    res = await client.post(
        "/api/v1/insurance",
        json={"booking_id": booking_id},
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 400


async def test_cancel_insurance(client, db_session):
    """Annule une assurance active."""
    booking_id, sender_token = await setup_accepted_booking(client, db_session, "5")

    await client.post(
        "/api/v1/insurance",
        json={"booking_id": booking_id},
        headers={"Authorization": f"Bearer {sender_token}"}
    )

    res = await client.delete(
        f"/api/v1/insurance/{booking_id}",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200

    # Vérifie que le booking est mis à jour
    result = await db_session.execute(
        select(Booking).where(Booking.id == booking_id)
    )
    booking = result.scalar_one()
    assert booking.insurance_subscribed is False


async def test_get_insurance(client, db_session):
    """Consulte une assurance souscrite."""
    booking_id, sender_token = await setup_accepted_booking(client, db_session, "6")

    await client.post(
        "/api/v1/insurance",
        json={"booking_id": booking_id},
        headers={"Authorization": f"Bearer {sender_token}"}
    )

    res = await client.get(
        f"/api/v1/insurance/{booking_id}",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "active"
