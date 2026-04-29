from datetime import date, timedelta
from sqlalchemy import update
from app.models.user import User
from app.models.booking import Booking

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


async def setup_delivered_booking(client, db_session, suffix: str) -> tuple:
    """Crée une réservation livrée."""
    carrier_token = await make_verified_carrier(
        client, db_session, f"carrier_r{suffix}@kipar.com"
    )
    sender_token = await register_and_login(client, f"sender_r{suffix}@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": f"receiver_r{suffix}@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres",
        "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    booking_id = booking.json()["id"]

    # Force le statut delivered
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id).values(status="delivered")
    )
    await db_session.flush()

    # Récupère carrier_id
    from sqlalchemy import select
    from app.models.user import User as UserModel
    res = await db_session.execute(
        select(UserModel).where(UserModel.email == f"carrier_r{suffix}@kipar.com")
    )
    carrier = res.scalar_one()

    return booking_id, sender_token, str(carrier.id)


async def test_create_review(client, db_session):
    """L'expéditeur laisse un avis sur le transporteur."""
    booking_id, sender_token, carrier_id = await setup_delivered_booking(
        client, db_session, "1"
    )
    res = await client.post("/api/v1/reviews", json={
        "booking_id": booking_id,
        "reviewed_id": carrier_id,
        "score": 4.5,
        "comment": "Très bon service"
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code == 201
    assert res.json()["score"] == 4.5


async def test_review_updates_trust_score(client, db_session):
    """Un avis met à jour le KiparTrust du transporteur."""
    booking_id, sender_token, carrier_id = await setup_delivered_booking(
        client, db_session, "2"
    )
    await client.post("/api/v1/reviews", json={
        "booking_id": booking_id,
        "reviewed_id": carrier_id,
        "score": 5.0,
    }, headers={"Authorization": f"Bearer {sender_token}"})

    # Vérifie que le score a changé
    from sqlalchemy import select
    from app.models.user import User as UserModel
    res = await db_session.execute(
        select(UserModel).where(UserModel.id == carrier_id)
    )
    carrier = res.scalar_one()
    assert carrier.trust_score > 0


async def test_review_duplicate_fails(client, db_session):
    """Impossible de laisser deux avis sur la même réservation."""
    booking_id, sender_token, carrier_id = await setup_delivered_booking(
        client, db_session, "3"
    )
    payload = {
        "booking_id": booking_id,
        "reviewed_id": carrier_id,
        "score": 4.0,
    }
    await client.post("/api/v1/reviews", json=payload,
        headers={"Authorization": f"Bearer {sender_token}"})
    res = await client.post("/api/v1/reviews", json=payload,
        headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code == 400


async def test_review_invalid_score(client, db_session):
    """Score invalide — doit retourner 422."""
    booking_id, sender_token, carrier_id = await setup_delivered_booking(
        client, db_session, "4"
    )
    res = await client.post("/api/v1/reviews", json={
        "booking_id": booking_id,
        "reviewed_id": carrier_id,
        "score": 6.0,
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code == 422
