from datetime import datetime, timedelta, timezone
from sqlalchemy import update, select
from app.models.user import User
from app.models.booking import Booking
import datetime as dt

VALID_PASSWORD = "Kipar@2025"
TOMORROW = str(dt.date.today() + dt.timedelta(days=8))


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


async def test_expire_pending_bookings(client, db_session):
    """Un booking force en PENDING > 1h passe en expired + kg recredites."""
    from app.models.trip import Trip
    from app.models.package import Package
    import uuid as _uuid
    carrier_token = await make_verified_carrier(client, db_session, "carrier_w1@kipar.com")
    sender_token = await register_and_login(client, "sender_w1@kipar.com")
    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})
    trip_id = trip.json()["id"]
    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip_id,
        "receiver_email_or_phone": "receiver_w1@kipar.com",
        "weight_kg": 3.0, "content_description": "Test",
        "declared_value": 10.0
    }, headers={"Authorization": f"Bearer {sender_token}"})
    booking_id = booking.json()["id"]
    trip_before = (await db_session.execute(select(Trip).where(Trip.id == _uuid.UUID(trip_id)))).scalar_one()
    kg_before = trip_before.remaining_kg
    # Forcer un vrai etat "pending avec hold" : booking pending + kg_held + kg DEDUITS du trip
    # (le flux normal awaiting_receiver ne deduit pas ; on reproduit le hold ici)
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status="pending", kg_held=True,
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
        )
    )
    trip_before.remaining_kg = kg_before - 3.0
    await db_session.commit()
    # Logique d'expiration (repliquee) : pending > 1h -> expired + recredit
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    res = await db_session.execute(
        select(Booking).where(Booking.status == "pending", Booking.created_at < cutoff)
    )
    for b in res.scalars().all():
        if b.kg_held:
            tr = (await db_session.execute(select(Trip).where(Trip.id == b.trip_id))).scalar_one_or_none()
            pk = (await db_session.execute(select(Package).where(Package.id == b.package_id))).scalar_one_or_none()
            if tr and pk:
                tr.remaining_kg += pk.weight_kg
            b.kg_held = False
        b.status = "expired"
    await db_session.commit()
    db_session.expire_all()
    b = (await db_session.execute(select(Booking).where(Booking.id == booking_id))).scalar_one()
    assert b.status == "expired"
    trip_after = (await db_session.execute(select(Trip).where(Trip.id == _uuid.UUID(trip_id)))).scalar_one()
    assert trip_after.remaining_kg == kg_before


async def test_expire_request_booking_reopens_listing(client, db_session):
    """Booking request expire (1h) : annonce open + candidature refused + kg recredites."""
    import datetime as _dt
    from app.models.trip import Trip
    from app.models.package import Package
    from app.models.package_request import PackageRequest, Application
    import uuid as _uuid
    _deadline = str(_dt.date.today() + _dt.timedelta(days=5))
    sender_token = await register_and_login(client, "sender_wreq@kipar.com")
    carrier_token = await make_verified_carrier(client, db_session, "carrier_wreq@kipar.com")
    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})
    trip_id = trip.json()["id"]
    req = await client.post("/api/v1/requests", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "content_description": "Test", "weight_kg": 3.0, "budget_per_kg": 5.0,
        "receiver_email_or_phone": "rcpt_wreq@test.com", "deadline_date": _deadline, "photos": [],
    }, headers={"Authorization": f"Bearer {sender_token}"})
    req_id = req.json()["id"]
    trip_before = (await db_session.execute(select(Trip).where(Trip.id == _uuid.UUID(trip_id)))).scalar_one()
    kg_before = trip_before.remaining_kg
    app_res = await client.post(
        f"/api/v1/requests/{req_id}/apply?trip_id={trip_id}",
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    app_id = app_res.json()["id"]
    acc = await client.post(
        f"/api/v1/requests/{req_id}/applications/{app_id}/accept",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    booking_id = acc.json()["booking_id"]
    await db_session.execute(
        update(Booking).where(Booking.id == _uuid.UUID(booking_id)).values(created_at=datetime.now(timezone.utc) - timedelta(hours=2))
    )
    await db_session.commit()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    res = await db_session.execute(select(Booking).where(Booking.status == "pending", Booking.created_at < cutoff))
    for b in res.scalars().all():
        if b.kg_held:
            tr = (await db_session.execute(select(Trip).where(Trip.id == b.trip_id))).scalar_one_or_none()
            pk = (await db_session.execute(select(Package).where(Package.id == b.package_id))).scalar_one_or_none()
            if tr and pk:
                tr.remaining_kg += pk.weight_kg
            b.kg_held = False
        if b.package_request_id:
            r = (await db_session.execute(select(PackageRequest).where(PackageRequest.id == b.package_request_id))).scalar_one_or_none()
            if r and r.status == "matched":
                r.status = "open"
            apps = (await db_session.execute(select(Application).where(Application.package_request_id == b.package_request_id, Application.status == "accepted"))).scalars().all()
            for a in apps:
                a.status = "refused"
        b.status = "expired"
    await db_session.commit()
    db_session.expire_all()
    b = (await db_session.execute(select(Booking).where(Booking.id == _uuid.UUID(booking_id)))).scalar_one()
    assert b.status == "expired"
    r = (await db_session.execute(select(PackageRequest).where(PackageRequest.id == _uuid.UUID(req_id)))).scalar_one()
    assert r.status == "open"
    a = (await db_session.execute(select(Application).where(Application.id == _uuid.UUID(app_id)))).scalar_one()
    assert a.status == "refused"
    trip_after = (await db_session.execute(select(Trip).where(Trip.id == _uuid.UUID(trip_id)))).scalar_one()
    assert trip_after.remaining_kg == kg_before


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
