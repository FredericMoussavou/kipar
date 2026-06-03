import pytest
from datetime import date, timedelta
from sqlalchemy import update
from app.models.user import User

VALID_PASSWORD = "Kipar@2025"
TOMORROW = str(date.today() + timedelta(days=8))
IN_3_DAYS = str(date.today() + timedelta(days=3))

REQUEST_PAYLOAD = {
    "origin_city": "Paris",
    "origin_airport_code": "CDG",
    "destination_city": "Dakar",
    "destination_airport_code": "DSS",
    "content_description": "Vetements et livres",
    "weight_kg": 3.0,
    "budget_per_kg": 5.0,
    "receiver_email_or_phone": "recepteur@test.com",
    "deadline_date": IN_3_DAYS,
    "photos": [],
}

TRIP_PAYLOAD = {
    "origin_city": "Paris",
    "origin_airport_code": "CDG",
    "destination_city": "Dakar",
    "destination_airport_code": "DSS",
    "departure_date": TOMORROW,
    "flight_number": "AF502",
    "airline": "Air France",
    "total_kg": 20.0,
    "max_kg_per_package": 10.0,
    "price_per_kg": 4.0,
}


async def register_and_login(client, email: str) -> str:
    await client.post("/api/v1/auth/register", json={
        "email": email, "password": VALID_PASSWORD,
        "first_name": "Test", "last_name": "User"
    })
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    return res.json()["access_token"]


async def make_verified_carrier(client, db_session, email: str) -> dict:
    token = await register_and_login(client, email)
    await db_session.execute(update(User).where(User.email == email).values(kyc_status="approved", is_carrier=True))
    await db_session.commit()
    res = await client.post("/api/v1/trips", json=TRIP_PAYLOAD, headers={"Authorization": f"Bearer {token}"})
    return {"token": token, "trip_id": res.json()["id"]}


async def test_create_request(client):
    """Un expéditeur peut créer une annonce."""
    token = await register_and_login(client, "sender_r1@kipar.com")
    res = await client.post("/api/v1/requests", json=REQUEST_PAYLOAD, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    assert res.json()["origin_airport_code"] == "CDG"


async def test_create_request_past_deadline(client):
    """Une annonce avec deadline passee est refusee."""
    token = await register_and_login(client, "sender_r2@kipar.com")
    payload = {**REQUEST_PAYLOAD, "deadline_date": str(date.today() - timedelta(days=1))}
    res = await client.post("/api/v1/requests", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 422


async def test_list_requests_public(client):
    """La liste des annonces est publique."""
    res = await client.get("/api/v1/requests")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


async def test_apply_to_request(client, db_session):
    """Un transporteur verifie peut candidater."""
    sender_token = await register_and_login(client, "sender_r3@kipar.com")
    req_res = await client.post("/api/v1/requests", json=REQUEST_PAYLOAD, headers={"Authorization": f"Bearer {sender_token}"})
    req_id = req_res.json()["id"]

    carrier = await make_verified_carrier(client, db_session, "carrier_r3@kipar.com")
    res = await client.post(
        f"/api/v1/requests/{req_id}/apply?trip_id={carrier['trip_id']}",
        headers={"Authorization": f"Bearer {carrier['token']}"}
    )
    assert res.status_code == 201
    assert res.json()["status"] == "pending"


async def test_apply_above_budget(client, db_session):
    """Un transporteur dont le prix depasse le budget est refuse."""
    sender_token = await register_and_login(client, "sender_r4@kipar.com")
    payload = {**REQUEST_PAYLOAD, "budget_per_kg": 1.0}
    req_res = await client.post("/api/v1/requests", json=payload, headers={"Authorization": f"Bearer {sender_token}"})
    req_id = req_res.json()["id"]

    carrier = await make_verified_carrier(client, db_session, "carrier_r4@kipar.com")
    res = await client.post(
        f"/api/v1/requests/{req_id}/apply?trip_id={carrier['trip_id']}",
        headers={"Authorization": f"Bearer {carrier['token']}"}
    )
    assert res.status_code == 400


async def test_accept_application(client, db_session):
    """L'expediteur accepte une candidature -> booking cree."""
    sender_token = await register_and_login(client, "sender_r5@kipar.com")
    req_res = await client.post("/api/v1/requests", json=REQUEST_PAYLOAD, headers={"Authorization": f"Bearer {sender_token}"})
    req_id = req_res.json()["id"]

    carrier = await make_verified_carrier(client, db_session, "carrier_r5@kipar.com")
    app_res = await client.post(
        f"/api/v1/requests/{req_id}/apply?trip_id={carrier['trip_id']}",
        headers={"Authorization": f"Bearer {carrier['token']}"}
    )
    app_id = app_res.json()["id"]

    res = await client.post(
        f"/api/v1/requests/{req_id}/applications/{app_id}/accept",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200
    assert "booking_id" in res.json()


async def test_delete_request(client):
    """L'expediteur peut supprimer son annonce."""
    token = await register_and_login(client, "sender_r6@kipar.com")
    req_res = await client.post("/api/v1/requests", json=REQUEST_PAYLOAD, headers={"Authorization": f"Bearer {token}"})
    req_id = req_res.json()["id"]

    res = await client.delete(f"/api/v1/requests/{req_id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 204


async def test_get_request_by_id(client):
    """GET /requests/{id} retourne l'annonce publiquement."""
    token = await register_and_login(client, "sender_r7@kipar.com")
    req_res = await client.post("/api/v1/requests", json=REQUEST_PAYLOAD, headers={"Authorization": f"Bearer {token}"})
    req_id = req_res.json()["id"]

    res = await client.get(f"/api/v1/requests/{req_id}")
    assert res.status_code == 200
    assert res.json()["id"] == req_id
    assert res.json()["origin_airport_code"] == "CDG"


async def test_get_request_mine_not_intercepted(client):
    """/requests/mine ne doit pas etre intercepte par /{request_id}."""
    token = await register_and_login(client, "sender_r8@kipar.com")
    await client.post("/api/v1/requests", json=REQUEST_PAYLOAD, headers={"Authorization": f"Bearer {token}"})

    res = await client.get("/api/v1/requests/mine", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert len(res.json()) >= 1


async def test_has_applied_false_before_apply(client, db_session):
    """has_applied est False avant de candidater."""
    sender_token = await register_and_login(client, "sender_r9@kipar.com")
    req_res = await client.post("/api/v1/requests", json=REQUEST_PAYLOAD, headers={"Authorization": f"Bearer {sender_token}"})
    req_id = req_res.json()["id"]

    carrier = await make_verified_carrier(client, db_session, "carrier_r9@kipar.com")
    res = await client.get("/api/v1/requests", headers={"Authorization": f"Bearer {carrier['token']}"})
    requests = res.json()
    target = next((r for r in requests if r["id"] == req_id), None)
    assert target is not None
    assert target["has_applied"] is False


async def test_has_applied_true_after_apply(client, db_session):
    """has_applied est True apres candidature."""
    sender_token = await register_and_login(client, "sender_r10@kipar.com")
    req_res = await client.post("/api/v1/requests", json=REQUEST_PAYLOAD, headers={"Authorization": f"Bearer {sender_token}"})
    req_id = req_res.json()["id"]

    carrier = await make_verified_carrier(client, db_session, "carrier_r10@kipar.com")
    await client.post(
        f"/api/v1/requests/{req_id}/apply?trip_id={carrier['trip_id']}",
        headers={"Authorization": f"Bearer {carrier['token']}"}
    )

    res = await client.get("/api/v1/requests", headers={"Authorization": f"Bearer {carrier['token']}"})
    requests = res.json()
    target = next((r for r in requests if r["id"] == req_id), None)
    assert target is not None
    assert target["has_applied"] is True


async def test_accept_application_sets_receiver(client, db_session):
    """Accepter une candidature resout le recepteur depuis la PackageRequest."""
    sender_token = await register_and_login(client, "sender_r11@kipar.com")
    req_res = await client.post("/api/v1/requests", json=REQUEST_PAYLOAD, headers={"Authorization": f"Bearer {sender_token}"})
    req_id = req_res.json()["id"]

    carrier = await make_verified_carrier(client, db_session, "carrier_r11@kipar.com")
    app_res = await client.post(
        f"/api/v1/requests/{req_id}/apply?trip_id={carrier['trip_id']}",
        headers={"Authorization": f"Bearer {carrier['token']}"}
    )
    app_id = app_res.json()["id"]

    res = await client.post(
        f"/api/v1/requests/{req_id}/applications/{app_id}/accept",
        headers={"Authorization": f"Bearer {sender_token}"}
    )
    assert res.status_code == 200
    booking_id = res.json()["booking_id"]

    # Verifier que le booking a bien un receiver_invitation cree
    from sqlalchemy import select
    from app.models.receiver_invitation import ReceiverInvitation
    import uuid
    inv_res = await db_session.execute(
        select(ReceiverInvitation).where(ReceiverInvitation.booking_id == uuid.UUID(booking_id))
    )
    inv = inv_res.scalar_one_or_none()
    assert inv is not None
    assert inv.contact == "recepteur@test.com"

async def test_apply_corridor_mismatch(client, db_session):
    """Un transporteur sur un corridor different de la demande est refuse."""
    # Demande expediteur : CDG -> DSS (corridor du REQUEST_PAYLOAD)
    sender_token = await register_and_login(client, "sender_r12@kipar.com")
    req_res = await client.post("/api/v1/requests", json=REQUEST_PAYLOAD, headers={"Authorization": f"Bearer {sender_token}"})
    req_id = req_res.json()["id"]

    # Transporteur avec un trajet sur un AUTRE corridor : LBV -> ORY
    carrier_token = await register_and_login(client, "carrier_r12@kipar.com")
    await db_session.execute(update(User).where(User.email == "carrier_r12@kipar.com").values(kyc_status="approved", is_carrier=True))
    await db_session.commit()
    other_trip = {**TRIP_PAYLOAD, "origin_airport_code": "LBV", "origin_city": "Libreville", "destination_airport_code": "ORY", "destination_city": "Paris Orly"}
    trip_res = await client.post("/api/v1/trips", json=other_trip, headers={"Authorization": f"Bearer {carrier_token}"})
    trip_id = trip_res.json()["id"]

    # Candidature hors corridor -> refus 400
    res = await client.post(
        f"/api/v1/requests/{req_id}/apply?trip_id={trip_id}",
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    assert res.status_code == 400


async def test_apply_same_corridor_ok(client, db_session):
    """Non-regression : un transporteur sur le meme corridor peut toujours candidater."""
    sender_token = await register_and_login(client, "sender_r13@kipar.com")
    req_res = await client.post("/api/v1/requests", json=REQUEST_PAYLOAD, headers={"Authorization": f"Bearer {sender_token}"})
    req_id = req_res.json()["id"]

    # make_verified_carrier cree un trajet CDG -> DSS, meme corridor que la demande
    carrier = await make_verified_carrier(client, db_session, "carrier_r13@kipar.com")
    res = await client.post(
        f"/api/v1/requests/{req_id}/apply?trip_id={carrier['trip_id']}",
        headers={"Authorization": f"Bearer {carrier['token']}"}
    )
    assert res.status_code == 201