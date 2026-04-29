from pydantic import BaseModel, field_validator
from datetime import date
import uuid


class TripCreate(BaseModel):
    origin_city: str
    origin_airport_code: str
    destination_city: str
    destination_airport_code: str
    departure_date: date
    flight_number: str | None = None
    airline: str | None = None
    total_kg: float
    max_kg_per_package: float = 5.0
    price_per_kg: float

    @field_validator("origin_airport_code", "destination_airport_code")
    @classmethod
    def uppercase_iata(cls, v: str) -> str:
        """Les codes IATA sont toujours en majuscules — CDG, DSS, LBV."""
        return v.upper().strip()

    @field_validator("total_kg", "max_kg_per_package", "price_per_kg")
    @classmethod
    def positive_values(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("La valeur doit être positive")
        return v

    @field_validator("departure_date")
    @classmethod
    def future_date(cls, v: date) -> date:
        if v <= date.today():
            raise ValueError("La date de départ doit être dans le futur")
        return v


class TripResponse(BaseModel):
    id: uuid.UUID
    carrier_id: uuid.UUID
    origin_city: str
    origin_airport_code: str
    destination_city: str
    destination_airport_code: str
    departure_date: date
    flight_number: str | None
    airline: str | None
    total_kg: float
    remaining_kg: float
    max_kg_per_package: float
    price_per_kg: float
    status: str

    model_config = {"from_attributes": True}
