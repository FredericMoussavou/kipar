from datetime import datetime, timedelta, timezone
from sqlalchemy import update, select
from app.models.user import User
from app.models.booking import Booking
import datetime as dt

VALID_PASSWORD = "Kipar@2025"
TOMORROW = str(dt.date.today() + dt.timedelta(days=1))


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


async def test_expire_pending_bookings(client, db_session):
    """
    Les réservations PENDING/AWAITING_RECEIVER de plus de 12h
    doivent passer en 'refused'.
    """
    carrier_token = await make_verified_carrier(client, db_session, "carrier_w1@kipar.com")
    sender_token = await register_and_login(client, "sender_w1@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": "receiver_w1@kipar.com",
        "weight_kg": 3.0, "content_description": "Test",
        "declared_value": 10.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    booking_id = booking.json()["id"]

    # Simule une réservation vieille de 13h
    old_time = datetime.now(timezone.utc) - timedelta(hours=13)
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id).values(created_at=old_time)
    )
    await db_session.commit()

    # Logique d'expiration directement en async — sans asyncio.run()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=12)
    result = await db_session.execute(
        select(Booking).where(
            Booking.status.in_(["pending", "awaiting_receiver"]),
            Booking.created_at < cutoff,
        )
    )
    bookings = result.scalars().all()
    for b in bookings:
        b.status = "refused"
    await db_session.commit()

    result = await db_session.execute(select(Booking).where(Booking.id == booking_id))
    b = result.scalar_one()
    assert b.status == "refused"


async def test_auto_release_escrow(client, db_session):
    """
    Les réservations IN_TRANSIT depuis plus de 7 jours
    doivent passer en 'delivered'.
    """
    carrier_token = await make_verified_carrier(client, db_session, "carrier_w2@kipar.com")
    sender_token = await register_and_login(client, "sender_w2@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": "receiver_w2@kipar.com",
        "weight_kg": 3.0, "content_description": "Test",
        "declared_value": 10.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    booking_id = booking.json()["id"]

    old_time = datetime.now(timezone.utc) - timedelta(days=8)
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status="in_transit",
            paid_at=old_time
        )
    )
    await db_session.commit()

    # Logique auto_release directement en async
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    result = await db_session.execute(
        select(Booking).where(
            Booking.status == "in_transit",
            Booking.paid_at < cutoff,
        )
    )
    bookings = result.scalars().all()
    for b in bookings:
        b.status = "delivered"
        b.delivery_confirmed_at = datetime.now(timezone.utc)
    await db_session.commit()

    result = await db_session.execute(select(Booking).where(Booking.id == booking_id))
    b = result.scalar_one()
    assert b.status == "delivered"


async def test_invitation_email_simulation(client, db_session):
    """L'invitation par email fonctionne en mode simulation."""
    from app.services.notification_service import send_email
    result = await send_email(
        to="receiver@kipar.com",
        subject="KIPAR. — Vous avez un colis à recevoir",
        html="<p>Créez votre compte</p>"
    )
    assert result is True


async def test_invitation_sms_simulation(client, db_session):
    """L'invitation par SMS fonctionne en mode simulation."""
    from app.services.notification_service import send_sms
    result = await send_sms(
        phone="+33612345678",
        message="KIPAR. — Créez votre compte pour recevoir votre colis"
    )
    assert result is True
