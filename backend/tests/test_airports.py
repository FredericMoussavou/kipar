async def test_search_paris(client):
    """Recherche 'paris' retourne CDG et ORY."""
    res = await client.get("/api/v1/airports?q=paris")
    assert res.status_code == 200
    codes = [a["code"] for a in res.json()["results"]]
    assert "CDG" in codes
    assert "ORY" in codes


async def test_search_dakar(client):
    """Recherche 'dakar' retourne DSS."""
    res = await client.get("/api/v1/airports?q=dakar")
    assert res.status_code == 200
    codes = [a["code"] for a in res.json()["results"]]
    assert "DSS" in codes


async def test_search_iata_exact(client):
    """Recherche par code IATA exact."""
    res = await client.get("/api/v1/airports?q=LBV")
    assert res.status_code == 200
    codes = [a["code"] for a in res.json()["results"]]
    assert "LBV" in codes


async def test_get_airport_by_code(client):
    """Retourne le détail d'un aéroport par code IATA."""
    res = await client.get("/api/v1/airports/CDG")
    assert res.status_code == 200
    data = res.json()
    assert data["code"] == "CDG"
    assert data["city"] == "Paris"
    assert data["country_code"] == "FR"


async def test_get_airport_not_found(client):
    """Retourne une erreur pour un code IATA inconnu."""
    res = await client.get("/api/v1/airports/XYZ")
    assert res.status_code == 200
    assert "error" in res.json()


async def test_search_by_country(client):
    """Recherche par pays retourne les bons aéroports."""
    res = await client.get("/api/v1/airports?q=senegal")
    assert res.status_code == 200
    assert res.json()["count"] >= 1


async def test_airports_by_continent_africa(client):
    """Liste les aéroports africains — au moins 40."""
    res = await client.get("/api/v1/airports/continent/AF")
    assert res.status_code == 200
    assert res.json()["count"] >= 40


async def test_trip_invalid_iata(client, db_session):
    """Créer un trajet avec un code IATA invalide retourne 422 traduit."""
    from sqlalchemy import update
    from app.models.user import User

    VALID_PASSWORD = "Kipar@2025"
    await client.post("/api/v1/auth/register", json={
        "email": "carrier_iata@kipar.com", "password": VALID_PASSWORD,
        "first_name": "Test", "last_name": "User"
    })
    await db_session.execute(
        update(User).where(User.email == "carrier_iata@kipar.com")
        .values(kyc_status="verified")
    )
    await db_session.flush()
    res = await client.post("/api/v1/auth/login", json={
        "email": "carrier_iata@kipar.com", "password": VALID_PASSWORD
    })
    token = res.json()["access_token"]

    from datetime import date, timedelta
    res = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "XXX",
        "destination_city": "Dakar", "destination_airport_code": "DSS",
        "departure_date": str(date.today() + timedelta(days=3)),
        "total_kg": 15.0, "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 422
    detail = res.json()["detail"]
    assert any("XXX" in e["message"] for e in detail)


async def test_trip_valid_iata(client, db_session):
    """Créer un trajet CDG → LBV fonctionne."""
    from sqlalchemy import update
    from app.models.user import User
    from datetime import date, timedelta

    VALID_PASSWORD = "Kipar@2025"
    await client.post("/api/v1/auth/register", json={
        "email": "carrier_lbv@kipar.com", "password": VALID_PASSWORD,
        "first_name": "Test", "last_name": "User"
    })
    await db_session.execute(
        update(User).where(User.email == "carrier_lbv@kipar.com")
        .values(kyc_status="verified")
    )
    await db_session.flush()
    res = await client.post("/api/v1/auth/login", json={
        "email": "carrier_lbv@kipar.com", "password": VALID_PASSWORD
    })
    token = res.json()["access_token"]

    res = await client.post("/api/v1/trips", json={
        "origin_city": "Paris", "origin_airport_code": "CDG",
        "destination_city": "Libreville", "destination_airport_code": "LBV",
        "departure_date": str(date.today() + timedelta(days=3)),
        "total_kg": 15.0, "max_kg_per_package": 5.0, "price_per_kg": 2.0
    }, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 201
    assert res.json()["destination_airport_code"] == "LBV"
