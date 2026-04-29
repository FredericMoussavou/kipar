from datetime import date, timedelta
from sqlalchemy import update, select
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


async def setup_in_transit_booking(client, db_session, suffix: str) -> tuple:
    """Crée une réservation en statut in_transit."""
    carrier_token = await make_verified_carrier(
        client, db_session, f"carrier_cl{suffix}@kipar.com"
    )
    sender_token = await register_and_login(client, f"sender_cl{suffix}@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    booking = await client.post("/api/v1/bookings", json={
        "trip_id": trip.json()["id"],
        "receiver_email_or_phone": f"receiver_cl{suffix}@kipar.com",
        "weight_kg": 3.0, "content_description": "Livres",
        "declared_value": 30.0
    }, headers={"Authorization": f"Bearer {sender_token}"})

    booking_id = booking.json()["id"]
    await db_session.execute(
        update(Booking).where(Booking.id == booking_id).values(status="in_transit")
    )
    await db_session.flush()

    return booking_id, sender_token


async def test_open_claim(client, db_session):
    """L'expéditeur peut ouvrir un litige sur une réservation en transit."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "1")

    res = await client.post("/api/v1/claims", json={
        "booking_id": booking_id,
        "claim_type": "non_delivery",
        "description": "Le colis n'a pas été livré à la date prévue.",
        "evidence_urls": []
    }, headers={"Authorization": f"Bearer {sender_token}"})

    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "open"
    assert data["claim_type"] == "non_delivery"


async def test_claim_freezes_booking(client, db_session):
    """L'ouverture d'un litige passe la réservation en 'disputed'."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "2")

    await client.post("/api/v1/claims", json={
        "booking_id": booking_id,
        "claim_type": "damaged",
        "description": "Colis endommagé à la réception.",
    }, headers={"Authorization": f"Bearer {sender_token}"})

    result = await db_session.execute(
        select(Booking).where(Booking.id == booking_id)
    )
    booking = result.scalar_one()
    assert booking.status == "disputed"


async def test_claim_duplicate_fails(client, db_session):
    """Impossible d'ouvrir deux litiges sur la même réservation."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "3")

    await client.post("/api/v1/claims", json={
        "booking_id": booking_id,
        "claim_type": "non_delivery",
        "description": "Premier litige.",
    }, headers={"Authorization": f"Bearer {sender_token}"})

    res = await client.post("/api/v1/claims", json={
        "booking_id": booking_id,
        "claim_type": "damaged",
        "description": "Deuxième litige.",
    }, headers={"Authorization": f"Bearer {sender_token}"})

    assert res.status_code == 400


async def test_get_claim(client, db_session):
    """Consulte un litige existant."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "4")

    claim = await client.post("/api/v1/claims", json={
        "booking_id": booking_id,
        "claim_type": "lost_airline",
        "description": "Bagage perdu par la compagnie.",
        "pir_document_url": "https://s3.kipar.app/pir/doc123.pdf"
    }, headers={"Authorization": f"Bearer {sender_token}"})

    claim_id = claim.json()["id"]
    res = await client.get(
        f"/api/v1/claims/{claim_id}",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200
    assert res.json()["pir_document_url"] == "https://s3.kipar.app/pir/doc123.pdf"


async def test_list_my_claims(client, db_session):
    """Liste les litiges de l'utilisateur connecté."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "5")

    await client.post("/api/v1/claims", json={
        "booking_id": booking_id,
        "claim_type": "wrong_content",
        "description": "Contenu ne correspond pas.",
    }, headers={"Authorization": f"Bearer {sender_token}"})

    res = await client.get(
        "/api/v1/claims",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200
    assert len(res.json()) >= 1


async def test_resolve_claim_requires_admin(client, db_session):
    """Seul un admin peut résoudre un litige."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "6")

    claim = await client.post("/api/v1/claims", json={
        "booking_id": booking_id,
        "claim_type": "non_delivery",
        "description": "Test resolve.",
    }, headers={"Authorization": f"Bearer {sender_token}"})

    claim_id = claim.json()["id"]
    res = await client.patch(
        f"/api/v1/claims/{claim_id}/resolve",
        json={
            "resolution": "favor_sender",
            "resolution_note": "Litige en faveur expéditeur.",
            "insurance_payout": 0.0
        },
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 403


async def test_resolve_claim_as_admin(client, db_session):
    """Un admin peut résoudre un litige."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "7")

    claim = await client.post("/api/v1/claims", json={
        "booking_id": booking_id,
        "claim_type": "non_delivery",
        "description": "Test admin resolve.",
    }, headers={"Authorization": f"Bearer {sender_token}"})

    claim_id = claim.json()["id"]

    # Passe l'expéditeur en admin
    await db_session.execute(
        update(User).where(User.email == "sender_cl7@kipar.com")
        .values(is_superuser=True)
    )
    await db_session.flush()

    res = await client.patch(
        f"/api/v1/claims/{claim_id}/resolve",
        json={
            "resolution": "favor_sender",
            "resolution_note": "Colis non livré confirmé.",
            "insurance_payout": 30.0
        },
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "resolved_sender"
    assert res.json()["insurance_payout"] == 30.0
