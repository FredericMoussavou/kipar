from datetime import date, timedelta
from sqlalchemy import update
from app.models.user import User

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


async def test_set_flight(client, db_session):
    """Le transporteur saisit son numéro de vol."""
    carrier_token = await make_verified_carrier(
        client, db_session, "carrier_t1@kipar.com"
    )
    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    res = await client.post(
        f"/api/v1/tracking/{trip.json()['id']}/flight",
        json={"flight_number": "HC402", "airline": "Air Senegal"},
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    assert res.status_code == 200
    assert res.json()["flight_number"] == "HC402"
    assert res.json()["status"] == "scheduled"


async def test_get_flight_status(client, db_session):
    """Récupère le statut d'un vol existant."""
    carrier_token = await make_verified_carrier(
        client, db_session, "carrier_t2@kipar.com"
    )
    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})
    trip_id = trip.json()["id"]

    await client.post(
        f"/api/v1/tracking/{trip_id}/flight",
        json={"flight_number": "HC402"},
        headers={"Authorization": f"Bearer {carrier_token}"}
    )

    res = await client.get(
        f"/api/v1/tracking/{trip_id}/flight",
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    assert res.status_code == 200
    assert res.json()["flight_number"] == "HC402"


async def test_get_flight_not_found(client, db_session):
    """404 si aucun vol n'est configuré pour ce trajet."""
    carrier_token = await make_verified_carrier(
        client, db_session, "carrier_t3@kipar.com"
    )
    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    res = await client.get(
        f"/api/v1/tracking/{trip.json()['id']}/flight",
        headers={"Authorization": f"Bearer {carrier_token}"}
    )
    assert res.status_code == 404


async def test_only_carrier_can_set_flight(client, db_session):
    """Un non-transporteur ne peut pas saisir le numéro de vol."""
    carrier_token = await make_verified_carrier(
        client, db_session, "carrier_t4@kipar.com"
    )
    other_token = await register_and_login(client, "other_t4@kipar.com")

    trip = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": TOMORROW, "total_kg": 15.0,
        "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {carrier_token}"})

    res = await client.post(
        f"/api/v1/tracking/{trip.json()['id']}/flight",
        json={"flight_number": "HC402"},
        headers={"Authorization": f"Bearer {other_token}"}
    )
    assert res.status_code == 403
