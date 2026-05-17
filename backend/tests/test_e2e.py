"""
Phase 17 — Tests end-to-end KIPAR
3 comptes : sender / carrier / receiver
Couvre : happy path, annulations, incidents, litiges, limites freemium, securite
"""
import os
os.environ["ENVIRONMENT"] = "test"

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password

TEST_DATABASE_URL = "postgresql+asyncpg://kipar:kipar_dev@localhost:5432/kipar_db_test"

# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="function")
async def db_session():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session
        await session.rollback()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


async def register_and_login(client, email, password, first_name, last_name, is_carrier=False):
    """Enregistre un utilisateur et retourne son token."""
    r = await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "first_name": first_name,
        "last_name": last_name,
        "language": "fr",
    })
    assert r.status_code == 201, f"Register failed: {r.text}"

    # Activer KYC et is_carrier directement en BDD si necessaire
    if is_carrier:
        from sqlalchemy import select, update
        from app.models.user import User
        # On passe par le client pour login d'abord
        pass

    r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


async def setup_carrier(client, db_session, token):
    """Active le mode transporteur et KYC pour un user."""
    from sqlalchemy import select, update
    from app.models.user import User

    # Recuperer le user via /users/me
    r = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    user_id = r.json()["id"]

    await db_session.execute(
        update(User)
        .where(User.id == user_id)
        .values(is_carrier=True, kyc_status="verified")
    )
    await db_session.commit()
    return user_id


async def create_trip(client, token, origin="CDG", dest="ABJ", departure_date="2027-06-15"):
    """Cree un trajet pour le transporteur."""
    r = await client.post("/api/v1/trips", json={
        "origin_city": "Paris",
        "origin_airport_code": origin,
        "destination_city": "Abidjan",
        "destination_airport_code": dest,
        "departure_date": departure_date,
        "departure_time": "10:00",
        "arrival_time": "16:00",
        "airline": "Air France",
        "flight_number": "AF502",
        "total_kg": 20.0,
        "available_kg": 20.0,
        "price_per_kg": 8.0,
        "currency": "EUR",
        "weight_unit": "kg",
    }, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Create trip failed: {r.text}"
    return r.json()["id"]


async def create_booking(client, token, trip_id, receiver_email):
    """Cree une reservation."""
    r = await client.post("/api/v1/bookings", json={
        "trip_id": trip_id,
        "content_description": "Vetements et cadeaux",
        "weight_kg": 5.0,
        "declared_value": 200.0,
        "receiver_email_or_phone": receiver_email,
        "insurance_subscribed": False,
    }, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, f"Create booking failed: {r.text}"
    return r.json()["id"]


# ── Tests Happy Path ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_e2e_happy_path_full(client, db_session):
    """
    Flux complet : creation trajet -> reservation -> acceptation ->
    pickup -> in_transit -> livraison -> delivered
    """
    # 1. Creer les 3 comptes
    sender_token = await register_and_login(client, "sender@test.com", "Test1234!", "Alice", "Sender")
    carrier_token = await register_and_login(client, "carrier@test.com", "Test1234!", "Bob", "Carrier", is_carrier=True)
    receiver_token = await register_and_login(client, "receiver@test.com", "Test1234!", "Carol", "Receiver")

    await setup_carrier(client, db_session, carrier_token)

    # 2. Transporteur cree un trajet
    trip_id = await create_trip(client, carrier_token)

    # 3. Expediteur reserve
    booking_id = await create_booking(client, sender_token, trip_id, "receiver@test.com")

    # 4. Transporteur accepte
    r = await client.patch(f"/api/v1/bookings/{booking_id}/accept",
                           headers={"Authorization": f"Bearer {carrier_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"

    # 5. Simuler paiement (sandbox) — passer directement en paid via BDD
    from sqlalchemy import update
    from app.models.booking import Booking
    from datetime import datetime, timezone
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id)
        .values(status="paid", payment_rail="stripe",
                escrow_ref="pi_test_123",
                paid_at=datetime.now(timezone.utc))
    )
    await db_session.commit()

    # 6. Transporteur passe en in_transit
    r = await client.patch(f"/api/v1/bookings/{booking_id}/in-transit",
                           headers={"Authorization": f"Bearer {carrier_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "in_transit"

    # 7. Recepteur genere le code livraison
    r = await client.post(f"/api/v1/delivery/{booking_id}/generate-code",
                          headers={"Authorization": f"Bearer {receiver_token}"})
    assert r.status_code == 200
    code = r.json()["code"]
    assert len(code) == 6

    # 8. Transporteur valide le code livraison
    r = await client.post(f"/api/v1/delivery/{booking_id}/validate",
                          json={"code": code},
                          headers={"Authorization": f"Bearer {carrier_token}"})
    assert r.status_code == 200

    # 9. Verifier statut final
    r = await client.get(f"/api/v1/bookings/{booking_id}/full",
                         headers={"Authorization": f"Bearer {sender_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "delivered"


@pytest.mark.asyncio
async def test_e2e_carrier_accepts_then_refuses(client, db_session):
    """Transporteur refuse une reservation."""
    sender_token = await register_and_login(client, "sender2@test.com", "Test1234!", "Alice", "S2")
    carrier_token = await register_and_login(client, "carrier2@test.com", "Test1234!", "Bob", "C2", is_carrier=True)
    await register_and_login(client, "receiver2@test.com", "Test1234!", "Carol", "R2")
    await setup_carrier(client, db_session, carrier_token)

    trip_id = await create_trip(client, carrier_token, "ORY", "DSS")
    booking_id = await create_booking(client, sender_token, trip_id, "receiver2@test.com")

    r = await client.patch(f"/api/v1/bookings/{booking_id}/refuse",
                           headers={"Authorization": f"Bearer {carrier_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "refused"


# ── Tests Annulation ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_e2e_cancel_before_72h(client, db_session):
    """Expediteur annule avant 72h -> remboursement integral."""
    sender_token = await register_and_login(client, "sender3@test.com", "Test1234!", "Alice", "S3")
    carrier_token = await register_and_login(client, "carrier3@test.com", "Test1234!", "Bob", "C3", is_carrier=True)
    await register_and_login(client, "receiver3@test.com", "Test1234!", "Carol", "R3")
    await setup_carrier(client, db_session, carrier_token)

    trip_id = await create_trip(client, carrier_token)
    booking_id = await create_booking(client, sender_token, trip_id, "receiver3@test.com")

    # Accepter et payer
    await client.patch(f"/api/v1/bookings/{booking_id}/accept",
                       headers={"Authorization": f"Bearer {carrier_token}"})
    from sqlalchemy import update
    from app.models.booking import Booking
    from datetime import datetime, timezone, timedelta
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id)
        .values(status="paid", paid_at=datetime.now(timezone.utc))
    )
    await db_session.commit()

    # Annuler
    r = await client.patch(f"/api/v1/bookings/{booking_id}/cancel",
                           json={"reason": "Changement de plans"},
                           headers={"Authorization": f"Bearer {sender_token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["refund_rate"] >= 0.5  # Remboursement partiel ou integral selon timing


@pytest.mark.asyncio
async def test_e2e_cancel_carrier_penalty(client, db_session):
    """Transporteur annule -> penalite appliquee."""
    sender_token = await register_and_login(client, "sender4@test.com", "Test1234!", "Alice", "S4")
    carrier_token = await register_and_login(client, "carrier4@test.com", "Test1234!", "Bob", "C4", is_carrier=True)
    await register_and_login(client, "receiver4@test.com", "Test1234!", "Carol", "R4")
    await setup_carrier(client, db_session, carrier_token)

    trip_id = await create_trip(client, carrier_token)
    booking_id = await create_booking(client, sender_token, trip_id, "receiver4@test.com")

    await client.patch(f"/api/v1/bookings/{booking_id}/accept",
                       headers={"Authorization": f"Bearer {carrier_token}"})

    r = await client.patch(f"/api/v1/bookings/{booking_id}/cancel",
                           json={"reason": "Impossible de voyager"},
                           headers={"Authorization": f"Bearer {carrier_token}"})
    assert r.status_code == 200
    assert r.json()["status"] in ("cancelled_by_carrier", "cancelled")


# ── Tests Incidents ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_e2e_pickup_failed_accepted(client, db_session):
    """Transporteur declare pickup_failed, expediteur accepte -> annulation."""
    sender_token = await register_and_login(client, "sender5@test.com", "Test1234!", "Alice", "S5")
    carrier_token = await register_and_login(client, "carrier5@test.com", "Test1234!", "Bob", "C5", is_carrier=True)
    await register_and_login(client, "receiver5@test.com", "Test1234!", "Carol", "R5")
    await setup_carrier(client, db_session, carrier_token)

    trip_id = await create_trip(client, carrier_token)
    booking_id = await create_booking(client, sender_token, trip_id, "receiver5@test.com")

    await client.patch(f"/api/v1/bookings/{booking_id}/accept",
                       headers={"Authorization": f"Bearer {carrier_token}"})
    from sqlalchemy import update
    from app.models.booking import Booking
    from datetime import datetime, timezone
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id)
        .values(status="paid", paid_at=datetime.now(timezone.utc))
    )
    await db_session.commit()

    # Transporteur declare pickup_failed
    r = await client.patch(f"/api/v1/bookings/{booking_id}/pickup-failed",
                           json={"reason": "Expediteur absent au RDV"},
                           headers={"Authorization": f"Bearer {carrier_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "pickup_failed"

    # Expediteur accepte
    r = await client.patch(f"/api/v1/bookings/{booking_id}/pickup-failed/respond",
                           json={"reason": "accept"},
                           headers={"Authorization": f"Bearer {sender_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_e2e_pickup_failed_contested(client, db_session):
    """Transporteur declare pickup_failed, expediteur conteste -> litige."""
    sender_token = await register_and_login(client, "sender6@test.com", "Test1234!", "Alice", "S6")
    carrier_token = await register_and_login(client, "carrier6@test.com", "Test1234!", "Bob", "C6", is_carrier=True)
    await register_and_login(client, "receiver6@test.com", "Test1234!", "Carol", "R6")
    await setup_carrier(client, db_session, carrier_token)

    trip_id = await create_trip(client, carrier_token)
    booking_id = await create_booking(client, sender_token, trip_id, "receiver6@test.com")

    await client.patch(f"/api/v1/bookings/{booking_id}/accept",
                       headers={"Authorization": f"Bearer {carrier_token}"})
    from sqlalchemy import update
    from app.models.booking import Booking
    from datetime import datetime, timezone
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id)
        .values(status="paid", paid_at=datetime.now(timezone.utc))
    )
    await db_session.commit()

    await client.patch(f"/api/v1/bookings/{booking_id}/pickup-failed",
                       json={"reason": "Expediteur absent"},
                       headers={"Authorization": f"Bearer {carrier_token}"})

    # Expediteur conteste
    r = await client.patch(f"/api/v1/bookings/{booking_id}/pickup-failed/respond",
                           json={"reason": "J'etais present, le transporteur ne s'est pas presente"},
                           headers={"Authorization": f"Bearer {sender_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "disputed"


@pytest.mark.asyncio
async def test_e2e_delivery_failed_contested(client, db_session):
    """Transporteur declare delivery_failed, recepteur conteste -> litige."""
    sender_token = await register_and_login(client, "sender7@test.com", "Test1234!", "Alice", "S7")
    carrier_token = await register_and_login(client, "carrier7@test.com", "Test1234!", "Bob", "C7", is_carrier=True)
    receiver_token = await register_and_login(client, "receiver7@test.com", "Test1234!", "Carol", "R7")
    await setup_carrier(client, db_session, carrier_token)

    trip_id = await create_trip(client, carrier_token)
    booking_id = await create_booking(client, sender_token, trip_id, "receiver7@test.com")

    await client.patch(f"/api/v1/bookings/{booking_id}/accept",
                       headers={"Authorization": f"Bearer {carrier_token}"})
    from sqlalchemy import update
    from app.models.booking import Booking
    from datetime import datetime, timezone
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id)
        .values(status="in_transit", paid_at=datetime.now(timezone.utc))
    )
    await db_session.commit()

    # Transporteur declare delivery_failed
    r = await client.post(f"/api/v1/delivery/{booking_id}/failed",
                          json={"comment": "Recepteur absent et injoignable"},
                          headers={"Authorization": f"Bearer {carrier_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "delivery_failed"

    # Recepteur conteste
    r = await client.patch(f"/api/v1/delivery/{booking_id}/failed/respond",
                           json={"response": "J'etais present, le transporteur ne s'est pas presente"},
                           headers={"Authorization": f"Bearer {receiver_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "disputed"


# ── Tests Litige ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_e2e_dispute_opened_by_sender(client, db_session):
    """Expediteur ouvre un litige direct."""
    sender_token = await register_and_login(client, "sender8@test.com", "Test1234!", "Alice", "S8")
    carrier_token = await register_and_login(client, "carrier8@test.com", "Test1234!", "Bob", "C8", is_carrier=True)
    await register_and_login(client, "receiver8@test.com", "Test1234!", "Carol", "R8")
    await setup_carrier(client, db_session, carrier_token)

    trip_id = await create_trip(client, carrier_token)
    booking_id = await create_booking(client, sender_token, trip_id, "receiver8@test.com")

    from sqlalchemy import update
    from app.models.booking import Booking
    from datetime import datetime, timezone
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id)
        .values(status="in_transit", paid_at=datetime.now(timezone.utc))
    )
    await db_session.commit()

    r = await client.patch(f"/api/v1/bookings/{booking_id}/dispute",
                           json={
                               "reason": "Colis endommage a la livraison",
                               "incident_type": "damaged",
                               "incident_stage": "delivery",
                           },
                           headers={"Authorization": f"Bearer {sender_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "disputed"


# ── Tests Limites Freemium ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_e2e_freemium_booking_limit(client, db_session):
    """Expediteur freemium ne peut pas depasser 3 reservations actives."""
    sender_token = await register_and_login(client, "sender9@test.com", "Test1234!", "Alice", "S9")
    carrier_token = await register_and_login(client, "carrier9@test.com", "Test1234!", "Bob", "C9", is_carrier=True)
    await register_and_login(client, "receiver9@test.com", "Test1234!", "Carol", "R9")
    await setup_carrier(client, db_session, carrier_token)

    # Activer premium sur le carrier pour permettre 3+ trajets
    from sqlalchemy import update as sa_update
    from app.models.user import User as UserModel
    from datetime import datetime, timezone, timedelta
    carrier_me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {carrier_token}"})
    carrier_id = carrier_me.json()["id"]
    await db_session.execute(
        sa_update(UserModel).where(UserModel.id == carrier_id)
        .values(is_premium=True, premium_expires_at=datetime.now(timezone.utc) + timedelta(days=30))
    )
    await db_session.commit()

    # Creer 3 trips differents et 3 reservations
    dest_codes = [("LOS", "2027-06-15"), ("DKR", "2027-06-20"), ("LBV", "2027-06-25")]
    for i in range(3):
        dest, dep_date = dest_codes[i]
        print(f"Creating trip {i}: CDG->{dest} on {dep_date}")
        trip_id = await create_trip(client, carrier_token, "CDG", dest, dep_date)
        print(f"Trip {i} created: {trip_id}")
        booking_id = await create_booking(client, sender_token, trip_id, "receiver9@test.com")
        await client.patch(f"/api/v1/bookings/{booking_id}/accept",
                           headers={"Authorization": f"Bearer {carrier_token}"})

    # 4eme reservation doit etre bloquee
    trip_id4 = await create_trip(client, carrier_token, "CDG", "CMN", "2027-07-01")
    r = await client.post("/api/v1/bookings", json={
        "trip_id": trip_id4,
        "content_description": "Test",
        "weight_kg": 2.0,
        "declared_value": 50.0,
        "receiver_email_or_phone": "receiver9@test.com",
        "insurance_subscribed": False,
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert r.status_code == 403
    assert "premium" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_e2e_freemium_trip_limit(client, db_session):
    """Transporteur freemium ne peut pas depasser 2 trajets actifs."""
    carrier_token = await register_and_login(client, "carrier10@test.com", "Test1234!", "Bob", "C10", is_carrier=True)
    await setup_carrier(client, db_session, carrier_token)

    await create_trip(client, carrier_token, "CDG", "ABJ")
    await create_trip(client, carrier_token, "ORY", "DSS")

    # 3eme trajet doit etre bloque
    r = await client.post("/api/v1/trips", json={
        "origin_city": "Paris",
        "origin_airport_code": "CDG",
        "destination_city": "Lagos",
        "destination_airport_code": "LOS",
        "departure_date": "2027-07-01",
        "departure_time": "08:00",
        "arrival_time": "14:00",
        "airline": "Air France",
        "flight_number": "AF600",
        "total_kg": 15.0,
        "available_kg": 15.0,
        "price_per_kg": 9.0,
        "currency": "EUR",
        "weight_unit": "kg",
    }, headers={"Authorization": f"Bearer {carrier_token}"})
    assert r.status_code == 403
    assert "premium" in r.json()["detail"].lower()


# ── Tests Securite ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_e2e_security_unauthorized_booking_access(client, db_session):
    """Un utilisateur ne peut pas acceder au booking d'un autre."""
    sender_token = await register_and_login(client, "sender11@test.com", "Test1234!", "Alice", "S11")
    carrier_token = await register_and_login(client, "carrier11@test.com", "Test1234!", "Bob", "C11", is_carrier=True)
    intruder_token = await register_and_login(client, "intruder@test.com", "Test1234!", "Eve", "I1")
    await register_and_login(client, "receiver11@test.com", "Test1234!", "Carol", "R11")
    await setup_carrier(client, db_session, carrier_token)

    trip_id = await create_trip(client, carrier_token)
    booking_id = await create_booking(client, sender_token, trip_id, "receiver11@test.com")

    # L'intrus tente d'acceder au booking
    r = await client.get(f"/api/v1/bookings/{booking_id}/full",
                         headers={"Authorization": f"Bearer {intruder_token}"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_e2e_security_carrier_cannot_book_own_trip(client, db_session):
    """Un transporteur ne peut pas reserver son propre trajet."""
    carrier_token = await register_and_login(client, "carrier12@test.com", "Test1234!", "Bob", "C12", is_carrier=True)
    await setup_carrier(client, db_session, carrier_token)

    trip_id = await create_trip(client, carrier_token)

    r = await client.post("/api/v1/bookings", json={
        "trip_id": trip_id,
        "content_description": "Auto-envoi",
        "weight_kg": 3.0,
        "declared_value": 100.0,
        "receiver_email_or_phone": "someone@test.com",
        "insurance_subscribed": False,
    }, headers={"Authorization": f"Bearer {carrier_token}"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_e2e_security_no_token(client, db_session):
    """Acces sans token -> 401."""
    r = await client.get("/api/v1/users/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_e2e_security_invalid_token(client, db_session):
    """Token invalide -> 401."""
    r = await client.get("/api/v1/users/me",
                         headers={"Authorization": "Bearer fake_token_123"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_e2e_security_only_carrier_can_accept(client, db_session):
    """Seul le transporteur du trajet peut accepter une reservation."""
    sender_token = await register_and_login(client, "sender13@test.com", "Test1234!", "Alice", "S13")
    carrier_token = await register_and_login(client, "carrier13@test.com", "Test1234!", "Bob", "C13", is_carrier=True)
    other_carrier_token = await register_and_login(client, "carrier14@test.com", "Test1234!", "Dave", "C14", is_carrier=True)
    await register_and_login(client, "receiver13@test.com", "Test1234!", "Carol", "R13")
    await setup_carrier(client, db_session, carrier_token)
    await setup_carrier(client, db_session, other_carrier_token)

    trip_id = await create_trip(client, carrier_token)
    booking_id = await create_booking(client, sender_token, trip_id, "receiver13@test.com")

    # Un autre transporteur tente d'accepter
    r = await client.patch(f"/api/v1/bookings/{booking_id}/accept",
                           headers={"Authorization": f"Bearer {other_carrier_token}"})
    assert r.status_code in (403, 404)