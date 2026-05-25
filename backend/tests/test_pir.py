from datetime import date, timedelta
from sqlalchemy import update, select
from app.models.user import User
from app.models.booking import Booking
from app.models.trip import Trip

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


async def setup_in_transit_trip(client, db_session, suffix: str) -> tuple:
    """Crée un trajet avec une réservation en transit."""
    carrier_token = await make_verified_carrier(
        client, db_session, f"carrier_pir{suffix}@kipar.com"
    )
    sender_token = await register_and_login(client, f"sender_pir{suffix}@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0,
        "flight_number": "HC402"
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    trip_id = trip.json()["id"]

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip_id,
        "receiver_email_or_phone": f"receiver_pir{suffix}@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres",
        "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    booking_id = booking.json()["id"]

    # Force trip et booking en in_transit
    await db_session.execute(
        update(Trip).where(Trip.id == trip_id).values(status="in_transit")
    )
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id).values(status="in_transit")
    )
    await db_session.flush()

    return trip_id, carrier_token, sender_token


async def test_report_lost_luggage(client, db_session):
    """Le transporteur signale un bagage perdu — crée un PIR."""
    trip_id, carrier_token, _ = await setup_in_transit_trip(client, db_session, "1")

    res = await client.post("/api/v1/pir", json={
        "trip_id": trip_id,
        "pir_document_url": "https://s3.kipar.app/pir/doc123.pdf",
        "airline_reference": "AF123456"
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "open"
    assert data["airline_reference"] == "AF123456"
    assert data["deadline_at"] is not None


async def test_pir_freezes_bookings(client, db_session):
    """L'ouverture d'un PIR passe tous les bookings du trajet en 'disputed'."""
    trip_id, carrier_token, _ = await setup_in_transit_trip(client, db_session, "2")

    await client.post("/api/v1/pir", json={
        "trip_id": trip_id,
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    result = await db_session.execute(
        select(Booking).where(Booking.trip_id == trip_id)
    )
    bookings = result.scalars().all()
    for booking in bookings:
        assert booking.status == "disputed"


async def test_pir_duplicate_fails(client, db_session):
    """Impossible de créer deux PIR pour le même trajet."""
    trip_id, carrier_token, _ = await setup_in_transit_trip(client, db_session, "3")

    await client.post("/api/v1/pir", json={
        "trip_id": trip_id,
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    res = await client.post("/api/v1/pir", json={
        "trip_id": trip_id,
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    assert res.status_code == 400


async def test_pir_found(client, db_session):
    """Bagage retrouvé — les bookings repassent en in_transit."""
    trip_id, carrier_token, _ = await setup_in_transit_trip(client, db_session, "4")

    pir = await client.post("/api/v1/pir", json={
        "trip_id": trip_id,
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    pir_id = pir.json()["id"]

    res = await client.patch(
        f"/api/v1/pir/{pir_id}",
        json={"status": "found", "resolution_note": "Bagage retrouvé à CDG."},
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    assert res.status_code == 200
    assert res.json()["found"] is True
    assert res.json()["status"] == "found"

    # Vérifie que les bookings sont repassés en in_transit
    result = await db_session.execute(
        select(Booking).where(Booking.trip_id == trip_id)
    )
    bookings = result.scalars().all()
    for booking in bookings:
        assert booking.status == "in_transit"


async def test_pir_lost_confirmed(client, db_session):
    """Perte confirmée — les bookings passent en refunded."""
    trip_id, carrier_token, _ = await setup_in_transit_trip(client, db_session, "5")

    pir = await client.post("/api/v1/pir", json={
        "trip_id": trip_id,
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    pir_id = pir.json()["id"]

    res = await client.patch(
        f"/api/v1/pir/{pir_id}",
        json={
            "status": "lost_confirmed",
            "resolution_note": "Bagage définitivement perdu après 21 jours."
        },
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    assert res.status_code == 200
    assert res.json()["found"] is False

    result = await db_session.execute(
        select(Booking).where(Booking.trip_id == trip_id)
    )
    bookings = result.scalars().all()
    for booking in bookings:
        assert booking.status == "refunded"


async def test_only_carrier_can_report(client, db_session):
    """Seul le transporteur du trajet peut créer un PIR."""
    trip_id, _, sender_token = await setup_in_transit_trip(client, db_session, "6")

    res = await client.post("/api/v1/pir", json={
        "trip_id": trip_id,
    }, headers={"Authorization": f"Bearer {sender_token}"})

    assert res.status_code == 403
