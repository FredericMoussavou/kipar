from fastapi import APIRouter, Query
from app.services.airport_service import search_airports, get_airport, get_airports_by_continent
from app.i18n.loader import t

router = APIRouter(prefix="/airports", tags=["airports"])


@router.get("")
async def search(
    q: str = Query(..., min_length=1, description="Recherche par code IATA, ville ou pays"),
    limit: int = Query(10, ge=1, le=20),
    lang: str = Query("fr"),
):
    results = search_airports(q, limit)
    return {"results": results, "count": len(results)}


@router.get("/continent/{continent}")
async def by_continent(continent: str):
    results = get_airports_by_continent(continent)
    return {"results": results, "count": len(results)}


@router.get("/{iata_code}")
async def get_one(
    iata_code: str,
    lang: str = Query("fr"),
):
    airport = get_airport(iata_code.upper())
    if not airport:
        return {"error": t("errors.airport_not_found", lang, code=iata_code.upper())}
    return {"code": iata_code.upper(), **airport}
