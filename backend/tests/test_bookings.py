from datetime import date, timedelta
import pytest

VALID_PASSWORD = "Kipar@2025"
TOMORROW = str(date.today() + timedelta(days=1))


async def register_and_login(client, email: str) -> dict:
    """Inscrit un user et retourne id + token."""
    res = await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": VALID_PASSWORD,
        "first_name": "Test",
        "last_name": "User"
    })
    token = res.json()["access_token"]
    login = await client.post("/api/v1/auth/login", json={
        "email": email, "password": VALID_PASSWORD
    })
    return {"token": login.json()["access_token"]}


async def create_verified_carrier(client, db_session, email: str) -> dict:
    """Crée un transporteur avec KYC vérifié."""
    from sqlalchemy import select, update
    from app.models.user import User

    data = await register_and_login(client, email)
    await db_session.execute(
        update(User).where(User.email == email).values(kyc_status="verified")
    )
    await db_session.flush()
    login = await client.post("/api/v1/auth/login", json={
        "email": email, "password": VALID_PASSWORD
    })
    return {"token": login.json()["access_token"]}


async def create_trip(client, token: str) -> dict:
    res = await client.post("/api/v1/trips", json={
        "origin_city": "Paris",
        "origin_airport_code": "CDG",
        "destination_city": "Dakar",
        "destination_airport_code": "DSS",
        "departure_date": TOMORROW,
        "total_kg": 15.0,
        "max_kg_per_package": 5.0,
        "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {token}"})
    return res.json()


async def test_create_booking(client, db_session):
    """Un expéditeur peut soumettre une demande sur un trajet."""
    carrier = await create_verified_carrier(client, db_session, "carrier_b1@kipar.com")
    trip = await create_trip(client, carrier["token"])

    sender = await register_and_login(client, "sender_b1@kipar.com")
    res = await client.post("/api/v1/bookings", json={
        "trip_id": trip["id"],
        "receiver_email_or_phone": "receiver_b1@kipar.com",
        "weight_kg": 3.0,
        "content_description": "Vêtements",
        "declared_value": 50.0
    }, headers={"Authorization": f"Bearer {sender['token']}"})
    assert res.status_code == 201
    assert res.json()["status"] in ("pending", "awaiting_receiver")
    assert res.json()["amount"] == 6.0  # 3kg * 2€


async def test_booking_exceeds_capacity(client, db_session):
    """Refus si le poids demandé dépasse la capacité du trajet."""
    carrier = await create_verified_carrier(client, db_session, "carrier_b2@kipar.com")
    trip = await create_trip(client, carrier["token"])

    sender = await register_and_login(client, "sender_b2@kipar.com")
    res = await client.post("/api/v1/bookings", json={
        "trip_id": trip["id"],
        "receiver_email_or_phone": "receiver@kipar.com",
        "weight_kg": 20.0,
        "content_description": "Trop lourd",
        "declared_value": 100.0
    }, headers={"Authorization": f"Bearer {sender['token']}"})
    assert res.status_code == 400


async def test_carrier_accept_booking(client, db_session):
    """Le transporteur peut accepter une demande."""
    carrier = await create_verified_carrier(client, db_session, "carrier_b3@kipar.com")
    trip = await create_trip(client, carrier["token"])

    sender = await register_and_login(client, "sender_b3@kipar.com")
    booking_res = await client.post("/api/v1/bookings", json={
        "trip_id": trip["id"],
        "receiver_email_or_phone": "receiver@kipar.com",
        "weight_kg": 3.0,
        "content_description": "Livres",
        "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender['token']}"})
    booking_id = booking_res.json()["id"]

    res = await client.patch(
        f"/api/v1/bookings/{booking_id}/accept",
        headers={"Authorization": f"Bearer {carrier['token']}"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "accepted"


async def test_carrier_refuse_booking(client, db_session):
    """Le transporteur peut refuser une demande."""
    carrier = await create_verified_carrier(client, db_session, "carrier_b4@kipar.com")
    trip = await create_trip(client, carrier["token"])

    sender = await register_and_login(client, "sender_b4@kipar.com")
    booking_res = await client.post("/api/v1/bookings", json={
        "trip_id": trip["id"],
        "receiver_email_or_phone": "receiver@kipar.com",
        "weight_kg": 2.0,
        "content_description": "Chaussures",
        "declared_value": 40.0
    }, headers={"Authorization": f"Bearer {sender['token']}"})
    booking_id = booking_res.json()["id"]

    res = await client.patch(
        f"/api/v1/bookings/{booking_id}/refuse",
        headers={"Authorization": f"Bearer {carrier['token']}"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "refused"


async def test_cancel_booking_restores_kg(client, db_session):
    """Annulation d'un booking restitue les kg au trip."""
    from sqlalchemy import select, update
    from app.models.user import User
    from app.models.trip import Trip
    import uuid

    carrier = await create_verified_carrier(client, db_session, "carrier_b_kg1@kipar.com")
    trip = await create_trip(client, carrier["token"])
    trip_id = trip["id"]

    sender = await register_and_login(client, "sender_b_kg1@kipar.com")
    booking_res = await client.post("/api/v1/bookings", json={
        "trip_id": trip_id,
        "receiver_email_or_phone": "recv_kg1@kipar.com",
        "weight_kg": 3.0,
        "content_description": "Vetements",
        "declared_value": 50.0
    }, headers={"Authorization": f"Bearer {sender['token']}"})
    assert booking_res.status_code == 201
    booking_id = booking_res.json()["id"]

    # Accepter le booking
    await db_session.execute(
        update(__import__('app.models.booking', fromlist=['Booking']).Booking)
        .where(__import__('app.models.booking', fromlist=['Booking']).Booking.id == uuid.UUID(booking_id))
        .values(status="accepted")
    )
    await db_session.commit()

    # Verifier kg avant annulation
    trip_res = await db_session.execute(select(Trip).where(Trip.id == uuid.UUID(trip_id)))
    trip_obj = trip_res.scalar_one_or_none()
    kg_before = trip_obj.remaining_kg

    # Annuler
    res = await client.patch(f"/api/v1/bookings/{booking_id}/cancel",
        json={"reason": "Test annulation"},
        headers={"Authorization": f"Bearer {sender['token']}"}
    )
    assert res.status_code == 200

    # Verifier kg apres annulation
    await db_session.refresh(trip_obj)
    assert trip_obj.remaining_kg == kg_before + 3.0


async def test_cancel_booking_by_carrier_restores_kg(client, db_session):
    """Annulation transporteur restitue aussi les kg."""
    from sqlalchemy import select, update
    from app.models.user import User
    from app.models.trip import Trip
    from app.models.booking import Booking
    import uuid

    carrier = await create_verified_carrier(client, db_session, "carrier_b_kg2@kipar.com")
    trip = await create_trip(client, carrier["token"])
    trip_id = trip["id"]

    sender = await register_and_login(client, "sender_b_kg2@kipar.com")
    booking_res = await client.post("/api/v1/bookings", json={
        "trip_id": trip_id,
        "receiver_email_or_phone": "recv_kg2@kipar.com",
        "weight_kg": 5.0,
        "content_description": "Electronique",
        "declared_value": 200.0
    }, headers={"Authorization": f"Bearer {sender['token']}"})
    assert booking_res.status_code == 201
    booking_id = booking_res.json()["id"]

    await db_session.execute(
        update(Booking).where(Booking.id == uuid.UUID(booking_id)).values(status="accepted")
    )
    await db_session.commit()

    trip_res = await db_session.execute(select(Trip).where(Trip.id == uuid.UUID(trip_id)))
    trip_obj = trip_res.scalar_one_or_none()
    kg_before = trip_obj.remaining_kg

    res = await client.patch(f"/api/v1/bookings/{booking_id}/cancel",
        json={"reason": "Indisponible"},
        headers={"Authorization": f"Bearer {carrier['token']}"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled_by_carrier"

    await db_session.refresh(trip_obj)
    assert trip_obj.remaining_kg == kg_before + 5.0
