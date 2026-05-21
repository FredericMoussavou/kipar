from datetime import date, timedelta, timezone, datetime
from sqlalchemy import update
from app.models.user import User
from app.models.booking import Booking

VALID_PASSWORD = "Kipar@2025"
TOMORROW = str(date.today() + timedelta(days=3))


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


async def setup_intransit_booking(client, db_session, suffix: str) -> tuple:
    """Crée une réservation en statut 'in_transit' — prête pour generate-code."""
    carrier_token = await make_verified_carrier(
        client, db_session, f"carrier_d{suffix}@kipar.com"
    )
    sender_token = await register_and_login(client, f"sender_d{suffix}@kipar.com")
    receiver_token = await register_and_login(client, f"receiver_d{suffix}@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": f"receiver_d{suffix}@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres",
        "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    booking_id = booking.json()["id"]

    # Accepte la réservation
    await client.patch(
        f"/api/v1/bookings/{booking_id}/accept",
        headers={"Authorization": f"Bearer {carrier_token}"}
    )

    # Force le statut à in_transit directement en DB
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id)
        .values(status="in_transit")
    )
    await db_session.flush()

    return booking_id, sender_token, carrier_token, receiver_token


async def test_generate_code(client, db_session):
    """Génère un code de remise sur une réservation in_transit (par le récepteur)."""
    booking_id, _, _, receiver_token = await setup_intransit_booking(client, db_session, "1")
    res = await client.post(
        f"/api/v1/delivery/{booking_id}/generate-code",
        headers={"Authorization": f"Bearer {receiver_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "code" in data
    assert len(data["code"]) == 6
    assert data["code"].isdigit()
    assert "qr_token" in data


async def test_generate_code_twice_fails(client, db_session):
    """Impossible de générer un code deux fois (booking déjà delivered)."""
    booking_id, _, _, receiver_token = await setup_intransit_booking(client, db_session, "2")
    await client.post(
        f"/api/v1/delivery/{booking_id}/generate-code",
        headers={"Authorization": f"Bearer {receiver_token}"}
    )
    res = await client.post(
        f"/api/v1/delivery/{booking_id}/generate-code",
        headers={"Authorization": f"Bearer {receiver_token}"}
    )
    assert res.status_code == 400


async def test_validate_delivery_correct_code(client, db_session):
    """Validation de livraison avec le bon code (transporteur valide après generate-code récepteur)."""
    booking_id, _, carrier_token, receiver_token = await setup_intransit_booking(
        client, db_session, "3"
    )

    # Récepteur génère le code → booking passe à delivered
    code_res = await client.post(
        f"/api/v1/delivery/{booking_id}/generate-code",
        headers={"Authorization": f"Bearer {receiver_token}"}
    )
    assert code_res.status_code == 200
    code = code_res.json()["code"]

    # Transporteur valide avec le bon code
    res = await client.post(
        f"/api/v1/delivery/{booking_id}/validate",
        json={"code": code},
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    assert res.status_code == 200
    assert "confirmée" in res.json()["message"]


async def test_validate_delivery_wrong_code(client, db_session):
    """Rejet avec un mauvais code."""
    booking_id, _, carrier_token, receiver_token = await setup_intransit_booking(
        client, db_session, "4"
    )

    # Récepteur génère le code → delivered
    await client.post(
        f"/api/v1/delivery/{booking_id}/generate-code",
        headers={"Authorization": f"Bearer {receiver_token}"}
    )

    # Transporteur tente avec mauvais code
    res = await client.post(
        f"/api/v1/delivery/{booking_id}/validate",
        json={"code": "000000"},
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    assert res.status_code == 400
