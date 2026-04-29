import json
import unicodedata
from pathlib import Path
from functools import lru_cache

AIRPORTS_FILE = Path(__file__).parent.parent / "data" / "airports.json"


@lru_cache(maxsize=1)
def load_airports() -> dict:
    with open(AIRPORTS_FILE, encoding="utf-8") as f:
        return json.load(f)


def normalize(text: str) -> str:
    """Supprime les accents et met en minuscules pour la recherche."""
    return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("utf-8").lower()


def get_airport(iata_code: str) -> dict | None:
    airports = load_airports()
    return airports.get(iata_code.upper())


def search_airports(query: str, limit: int = 10) -> list[dict]:
    """
    Recherche d'aéroports par code IATA, ville ou pays.
    Insensible aux accents et à la casse.
    """
    airports = load_airports()
    q = normalize(query.strip())
    results = []

    for code, data in airports.items():
        if (
            q in normalize(code)
            or q in normalize(data["city"])
            or q in normalize(data["name"])
            or q in normalize(data["country"])
        ):
            results.append({
                "code": code,
                "name": data["name"],
                "city": data["city"],
                "country": data["country"],
                "country_code": data["country_code"],
                "continent": data["continent"],
            })
        if len(results) >= limit:
            break

    # Priorité : correspondance exacte IATA en premier
    results.sort(key=lambda x: (
        0 if normalize(x["code"]) == q else
        1 if normalize(x["city"]).startswith(q) else
        2
    ))
    return results[:limit]


def validate_iata(code: str) -> bool:
    return get_airport(code) is not None


def get_airports_by_continent(continent: str) -> list[dict]:
    airports = load_airports()
    return [
        {"code": code, **data}
        for code, data in airports.items()
        if data["continent"] == continent.upper()
    ]
