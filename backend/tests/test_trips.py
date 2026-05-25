import pytest
from datetime import date, timedelta

VALID_PASSWORD = "Kipar@2025"
TOMORROW = str(date.today() + timedelta(days=8))


async def register_and_login(client, email: str) -> str:
    """Helper — inscrit un user et retourne son access token."""
    await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": VALID_PASSWORD,
        "first_name": "Test",
        "last_name": "User"
    })
    res = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": VALID_PASSWORD
    })
    return res.json()["access_token"]


TRIP_PAYLOAD = {
    "origin_city": "Paris",
    "origin_airport_code": "CDG",
    "destination_city": "Dakar",
    "destination_airport_code": "DSS",
    "departure_date": TOMORROW,
    "flight_number": "HC402",
    "airline": "Air Senegal",
    "total_kg": 15.0,
    "max_kg_per_package": 5.0,
    "price_per_kg": 2.0
}


async def test_create_trip_requires_kyc(client):
    """Un user sans KYC ne peut pas créer un trajet."""
    token = await register_and_login(client, "carrier1@kipar.com")
    res = await client.post(
        "/api/v1/trips",
        json=TRIP_PAYLOAD,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 403


async def test_search_trips_public(client):
    """La recherche de trajets est publique — pas besoin d'être connecté."""
    res = await client.get("/api/v1/trips")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


async def test_search_trips_filter(client):
    """Filtrer par origine et destination."""
    res = await client.get("/api/v1/trips?origin=CDG&destination=DSS")
    assert res.status_code == 200


async def test_get_trip_not_found(client):
    """Un trajet inexistant retourne 404."""
    res = await client.get("/api/v1/trips/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404

async def test_create_trip_past_date_rejected(client, db_session):
    """Un trip avec une date passee est refuse a la creation."""
    from sqlalchemy import update
    from app.models.user import User as UserModel
    carrier = await register_and_login(client, "carrier_past@kipar.com")
    await db_session.execute(update(UserModel).where(UserModel.email == "carrier_past@kipar.com").values(kyc_status="approved"))
    await db_session.commit()
    yesterday = str(date.today() - timedelta(days=1))
    payload = {**TRIP_PAYLOAD, "departure_date": yesterday}
    res = await client.post(
        "/api/v1/trips",
        json=payload,
        headers={"Authorization": f"Bearer {carrier}"}
    )
    assert res.status_code == 422

async def test_search_trips_excludes_past(client):
    """Les trips avec departure_date < today n apparaissent pas dans la recherche publique."""
    res = await client.get("/api/v1/trips")
    assert res.status_code == 200
    trips = res.json()
    today = str(date.today())
    for trip in trips:
        assert trip["departure_date"] >= today

