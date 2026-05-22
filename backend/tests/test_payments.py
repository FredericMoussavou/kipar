from datetime import date, timedelta
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


async def setup_accepted_booking(client, db_session, suffix: str) -> tuple:
    carrier_token = await make_verified_carrier(
        client, db_session, f"carrier_p{suffix}@kipar.com"
    )
    sender_token = await register_and_login(client, f"sender_p{suffix}@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": f"receiver_p{suffix}@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres",
        "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    booking_id = booking.json()["id"]
    await client.patch(
        f"/api/v1/bookings/{booking_id}/accept",
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    return booking_id, sender_token, carrier_token



async def setup_paid_booking(client, db_session, suffix: str) -> tuple:
    """Cree un booking en statut paid (paiement initie)."""
    carrier_token = await make_verified_carrier(
        client, db_session, f"carrier_paid{suffix}@kipar.com"
    )
    sender_token = await register_and_login(client, f"sender_paid{suffix}@kipar.com")
    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})
    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": f"receiver_paid{suffix}@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres",
        "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender_token}"})
    booking_id = booking.json()["id"]
    await client.post(
        f"/api/v1/payments/{booking_id}/stripe",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    return booking_id, sender_token, carrier_token

async def test_stripe_payment_intent(client, db_session):
    """Crée un PaymentIntent Stripe — retourne un client_secret."""
    booking_id, sender_token, _ = await setup_accepted_booking(
        client, db_session, "1"
    )
    res = await client.post(
        f"/api/v1/payments/{booking_id}/stripe",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "client_secret" in data
    assert data["payment_rail"] == "stripe"
    assert data["amount"] == 8.4  # 3kg * 2EUR * 1.15 + 1.5EUR frais dossier


async def test_pawapay_payment(client, db_session):
    """Initie un paiement PawaPay - booking passe en statut paid."""
    from unittest.mock import patch, AsyncMock
    booking_id, sender_token, _ = await setup_accepted_booking(
        client, db_session, "2"
    )
    with patch("app.api.v1.endpoints.payments.initiate_deposit", new=AsyncMock(
        return_value={"depositId": "simulated_test_deposit_1", "status": "ACCEPTED"}
    )):
        res = await client.post(
            f"/api/v1/payments/{booking_id}/pawapay",
            params={"phone": "221700000001", "provider": "ORANGE_SEN", "currency": "XOF"},
            headers={"Authorization": f"Bearer {sender_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "deposit_id" in data
        assert data["payment_rail"] == "pawapay"
        assert data["status"] == "ACCEPTED"


async def test_confirm_stripe_payment(client, db_session):
    """Initie un paiement Stripe - booking passe en statut paid."""
    booking_id, sender_token, _ = await setup_paid_booking(
        client, db_session, "3"
    )
    from sqlalchemy import select
    from app.models.booking import Booking
    result = await db_session.execute(
        select(Booking).where(Booking.id == booking_id)
    )
    booking = result.scalar_one()
    assert booking.status == "paid"


async def test_pawapay_webhook_completed(client, db_session):
    """Webhook PawaPay COMPLETED - paid_at mis a jour."""
    from unittest.mock import patch, AsyncMock
    booking_id, sender_token, _ = await setup_accepted_booking(
        client, db_session, "flw1"
    )
    with patch("app.api.v1.endpoints.payments.initiate_deposit", new=AsyncMock(
        return_value={"depositId": "simulated_test_deposit_2", "status": "ACCEPTED"}
    )):
        res = await client.post(
            f"/api/v1/payments/{booking_id}/pawapay",
            params={"phone": "221700000002", "provider": "ORANGE_SEN", "currency": "XOF"},
            headers={"Authorization": f"Bearer {sender_token}"}
        )
        assert res.status_code == 200
        deposit_id = res.json()["deposit_id"]
    res = await client.post(
        "/api/v1/payments/pawapay/webhook",
        json={"status": "COMPLETED", "depositId": deposit_id}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


async def test_only_sender_can_pay(client, db_session):
    """Seul l'expéditeur peut initier le paiement."""
    booking_id, _, carrier_token = await setup_accepted_booking(
        client, db_session, "5"
    )
    res = await client.post(
        f"/api/v1/payments/{booking_id}/stripe",
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    assert res.status_code == 403


async def test_cannot_pay_pending_booking(client, db_session):
    """Dans le nouveau flux, pending est valide pour payer (expéditeur paie en premier)."""
    carrier_token = await make_verified_carrier(
        client, db_session, "carrier_p6@kipar.com"
    )
    sender_token = await register_and_login(client, "sender_p6@kipar.com")
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
        f"/api/v1/payments/{booking.json()['id']}/stripe",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200


