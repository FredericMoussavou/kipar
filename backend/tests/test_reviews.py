from datetime import date, timedelta
from sqlalchemy import update
from app.models.user import User
from app.models.booking import Booking

VALID_PASSWORD = "Kipar@2025"
TOMORROW = str(date.today() + timedelta(days=1))

CRITERIA_SENDER_TO_CARRIER = {
    "ponctualite": 4,
    "communication": 5,
    "soin_colis": 4,
    "conformite": 5,
}

CRITERIA_CARRIER_TO_SENDER = {
    "communication": 4,
    "colis_prepare": 5,
    "ponctualite_depot": 4,
    "serieux": 5,
}


async def register_and_login(client, email: str) -> str:
    await client.post("/api/v1/auth/register", json={
        "email": email, "password": VALID_PASSWORD,
        "first_name": "Test", "last_name": "User"
    })
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    return res.json()["access_token"]


async def make_verified_carrier(client, db_session, email: str) -> str:
    await register_and_login(client, email)
    await db_session.execute(update(User).where(User.email == email).values(kyc_status="verified"))
    await db_session.flush()
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    return res.json()["access_token"]


async def setup_delivered_booking(client, db_session, suffix: str) -> tuple:
    carrier_token = await make_verified_carrier(client, db_session, f"carrier_rv{suffix}@kipar.com")
    sender_token = await register_and_login(client, f"sender_rv{suffix}@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": f"receiver_rv{suffix}@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres", "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    booking_id = booking.json()["id"]
    await db_session.execute(update(Booking).where(Booking.id == booking_id).values(status="delivered"))
    await db_session.flush()

    from sqlalchemy import select
    res = await db_session.execute(select(User).where(User.email == f"carrier_rv{suffix}@kipar.com"))
    carrier = res.scalar_one()
    return booking_id, sender_token, carrier_token, str(carrier.id)


async def test_create_review_sender_to_carrier(client, db_session):
    """Expediteur note le transporteur avec criteres multicriteres."""
    booking_id, sender_token, _, carrier_id = await setup_delivered_booking(client, db_session, "1")
    res = await client.post("/api/v1/reviews", json={
        "booking_id": booking_id,
        "reviewed_id": carrier_id,
        "criteria": CRITERIA_SENDER_TO_CARRIER,
        "comment": "Excellent service",
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code == 201
    data = res.json()
    assert data["reviewer_role"] == "sender_to_carrier"
    assert data["score"] == round(sum(CRITERIA_SENDER_TO_CARRIER.values()) / len(CRITERIA_SENDER_TO_CARRIER), 2)


async def test_create_review_carrier_to_sender(client, db_session):
    """Transporteur note l'expediteur."""
    booking_id, _, carrier_token, carrier_id = await setup_delivered_booking(client, db_session, "2")
    from sqlalchemy import select
    res = await db_session.execute(select(User).where(User.email == "sender_rv2@kipar.com"))
    sender = res.scalar_one()
    res = await client.post("/api/v1/reviews", json={
        "booking_id": booking_id,
        "reviewed_id": str(sender.id),
        "criteria": CRITERIA_CARRIER_TO_SENDER,
    }, headers={"Authorization": f"Bearer {carrier_token}"})
    assert res.status_code == 201
    assert res.json()["reviewer_role"] == "carrier_to_sender"


async def test_review_updates_trust_score(client, db_session):
    """Un avis met a jour le KiparTrust du transporteur."""
    booking_id, sender_token, _, carrier_id = await setup_delivered_booking(client, db_session, "3")
    await client.post("/api/v1/reviews", json={
        "booking_id": booking_id,
        "reviewed_id": carrier_id,
        "criteria": CRITERIA_SENDER_TO_CARRIER,
    }, headers={"Authorization": f"Bearer {sender_token}"})

    from sqlalchemy import select
    import uuid
    res = await db_session.execute(select(User).where(User.id == uuid.UUID(carrier_id)))
    carrier = res.scalar_one()
    assert carrier.trust_score > 0


async def test_review_duplicate_fails(client, db_session):
    """Impossible de laisser deux avis sur la meme reservation."""
    booking_id, sender_token, _, carrier_id = await setup_delivered_booking(client, db_session, "4")
    payload = {"booking_id": booking_id, "reviewed_id": carrier_id, "criteria": CRITERIA_SENDER_TO_CARRIER}
    await client.post("/api/v1/reviews", json=payload, headers={"Authorization": f"Bearer {sender_token}"})
    res = await client.post("/api/v1/reviews", json=payload, headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code == 400


async def test_review_missing_criteria_fails(client, db_session):
    """Criteres manquants — doit retourner 422."""
    booking_id, sender_token, _, carrier_id = await setup_delivered_booking(client, db_session, "5")
    res = await client.post("/api/v1/reviews", json={
        "booking_id": booking_id,
        "reviewed_id": carrier_id,
        "criteria": {"ponctualite": 4},  # manque communication, soin_colis, conformite
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code == 422


async def test_review_cancelled_by_carrier(client, db_session):
    """Expediteur peut noter le transporteur apres annulation tardive."""
    booking_id, sender_token, _, carrier_id = await setup_delivered_booking(client, db_session, "6")
    await db_session.execute(update(Booking).where(Booking.id == booking_id).values(status="cancelled_by_carrier"))
    await db_session.flush()
    res = await client.post("/api/v1/reviews", json={
        "booking_id": booking_id,
        "reviewed_id": carrier_id,
        "criteria": CRITERIA_SENDER_TO_CARRIER,
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code == 201


async def test_review_not_allowed_wrong_role(client, db_session):
    """Expediteur ne peut pas noter l'expediteur lui-meme."""
    booking_id, sender_token, _, carrier_id = await setup_delivered_booking(client, db_session, "7")
    from sqlalchemy import select
    res = await db_session.execute(select(User).where(User.email == "sender_rv7@kipar.com"))
    sender = res.scalar_one()
    res = await client.post("/api/v1/reviews", json={
        "booking_id": booking_id,
        "reviewed_id": str(sender.id),
        "criteria": CRITERIA_SENDER_TO_CARRIER,
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code == 403


async def test_can_review_endpoint(client, db_session):
    """L'endpoint can-review retourne les bons criteres."""
    booking_id, sender_token, _, carrier_id = await setup_delivered_booking(client, db_session, "8")
    res = await client.get(
        f"/api/v1/reviews/booking/{booking_id}/can-review?reviewed_id={carrier_id}",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["can_review"] is True
    assert data["role"] == "sender_to_carrier"
    assert set(data["criteria"]) == {"ponctualite", "communication", "soin_colis", "conformite"}
