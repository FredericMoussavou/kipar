"""
Tests disputes (anciennement claims).
Les claims ont ete migres vers disputes - ce fichier teste le nouveau systeme unifie.
"""
from datetime import date, timedelta
from sqlalchemy import update, select
from app.models.user import User
from app.models.booking import Booking
from app.models.dispute import Dispute

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
        "declared_value": 50.0, "insurance_subscribed": False,
    }, headers={"Authorization": f"Bearer {sender_token}"})
    booking_id = booking.json()["id"]
    await client.patch(f"/api/v1/bookings/{booking_id}/accept",
        headers={"Authorization": f"Bearer {carrier_token}"})
    await client.patch(f"/api/v1/bookings/{booking_id}/in-transit",
        headers={"Authorization": f"Bearer {carrier_token}"})
    return booking_id, sender_token


async def test_open_dispute(client, db_session):
    """Un expediteur peut ouvrir un litige sur un booking in_transit."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "1")
    res = await client.patch(f"/api/v1/bookings/{booking_id}/dispute", json={
        "reason": "Colis endommage a la livraison.",
        "incident_type": "damaged",
        "incident_stage": "delivery",
        "declared_value": 50.0,
        "evidence_urls": [],
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code == 200
    assert res.json()["status"] == "disputed"
    assert res.json()["dispute_id"] is not None
    assert res.json()["role"] == "sender"


async def test_dispute_duplicate_fails(client, db_session):
    """Impossible d'ouvrir deux litiges sur le meme booking."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "2")
    await client.patch(f"/api/v1/bookings/{booking_id}/dispute", json={
        "reason": "Premier litige.", "incident_type": "damaged",
    }, headers={"Authorization": f"Bearer {sender_token}"})
    res = await client.patch(f"/api/v1/bookings/{booking_id}/dispute", json={
        "reason": "Deuxieme litige.", "incident_type": "lost",
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code in (409, 400)  # 409 si booking encore ouvert, 400 si deja disputed


async def test_dispute_reason_required(client, db_session):
    """Le motif est obligatoire pour ouvrir un litige."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "3")
    res = await client.patch(f"/api/v1/bookings/{booking_id}/dispute", json={
        "reason": "", "incident_type": "damaged",
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code == 400


async def test_admin_get_dispute(client, db_session):
    """Admin peut voir le detail complet d'un litige."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "4")
    dispute_res = await client.patch(f"/api/v1/bookings/{booking_id}/dispute", json={
        "reason": "Test admin view.", "incident_type": "damaged",
    }, headers={"Authorization": f"Bearer {sender_token}"})
    dispute_id = dispute_res.json()["dispute_id"]

    await db_session.execute(
        update(User).where(User.email == "sender_cl4@kipar.com")
        .values(is_admin=True)
    )
    await db_session.flush()
    admin_token = (await client.post("/api/v1/auth/login", json={
        "email": "sender_cl4@kipar.com", "password": VALID_PASSWORD
    })).json()["access_token"]

    res = await client.get(f"/api/v1/admin/disputes/{dispute_id}",
        headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["incident_type"] == "damaged"
    assert data["initiated_by_role"] == "sender"
    assert data["initiator"] is not None
    assert data["booking"] is not None
    assert "timeline" in data


async def test_resolve_dispute_requires_admin(client, db_session):
    """Seul un admin peut resoudre un litige."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "5")
    dispute_res = await client.patch(f"/api/v1/bookings/{booking_id}/dispute", json={
        "reason": "Test resolve auth.", "incident_type": "other",
    }, headers={"Authorization": f"Bearer {sender_token}"})
    dispute_id = dispute_res.json()["dispute_id"]
    res = await client.patch(f"/api/v1/admin/disputes/{dispute_id}/resolve", json={
        "decision": "resolved_sender", "resolution": "Test."
    }, headers={"Authorization": f"Bearer {sender_token}"})
    assert res.status_code == 403


async def test_resolve_dispute_as_admin(client, db_session):
    """Un admin peut resoudre un litige."""
    booking_id, sender_token = await setup_in_transit_booking(client, db_session, "6")
    dispute_res = await client.patch(f"/api/v1/bookings/{booking_id}/dispute", json={
        "reason": "Colis non livre.", "incident_type": "non_delivery",
    }, headers={"Authorization": f"Bearer {sender_token}"})
    dispute_id = dispute_res.json()["dispute_id"]

    await db_session.execute(
        update(User).where(User.email == "sender_cl6@kipar.com")
        .values(is_admin=True)
    )
    await db_session.flush()
    admin_token = (await client.post("/api/v1/auth/login", json={
        "email": "sender_cl6@kipar.com", "password": VALID_PASSWORD
    })).json()["access_token"]

    res = await client.patch(f"/api/v1/admin/disputes/{dispute_id}/resolve", json={
        "decision": "resolved_sender",
        "resolution": "Litige en faveur expediteur confirme."
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.json()["status"] == "resolved_sender"
