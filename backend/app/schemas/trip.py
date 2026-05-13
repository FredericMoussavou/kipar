from pydantic import BaseModel, field_validator
from datetime import date
import uuid
from app.services.airport_service import validate_iata

class TripCreate(BaseModel):
    origin_city: str
    origin_airport_code: str
    destination_city: str
    destination_airport_code: str
    departure_date: date
    departure_time: str | None = None
    arrival_date: str | None = None
    arrival_time: str | None = None
    flight_number: str | None = None
    airline: str | None = None
    total_kg: float
    max_kg_per_package: float = 5.0
    price_per_kg: float
    weight_unit: str = "kg"
    currency: str = "EUR"

    @field_validator("origin_airport_code", "destination_airport_code")
    @classmethod
    def validate_iata_code(cls, v: str) -> str:
        code = v.upper().strip()
        if not validate_iata(code):
            raise ValueError(f"IATA_INVALID:{code}")
        return code

    @field_validator("total_kg", "max_kg_per_package", "price_per_kg")
    @classmethod
    def positive_values(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("La valeur doit etre positive")
        return v

    @field_validator("departure_date")
    @classmethod
    def future_date(cls, v: date) -> date:
        from datetime import date as d
        if v <= d.today():
            raise ValueError("La date de depart doit etre dans le futur")
        return v

class TripResponse(BaseModel):
    id: uuid.UUID
    carrier_id: uuid.UUID
    origin_city: str
    origin_airport_code: str
    destination_city: str
    destination_airport_code: str
    departure_date: date
    departure_time: str | None = None
    arrival_date: str | None = None
    arrival_time: str | None = None
    flight_number: str | None
    airline: str | None
    total_kg: float
    remaining_kg: float
    max_kg_per_package: float
    price_per_kg: float
    status: str
    trust_score: float | None = None
    carrier_full_name: str | None = None
    carrier_avatar_url: str | None = None
    carrier_kyc_status: str | None = None
    carrier_member_since: int | None = None
    carrier_trip_count: int | None = None
    carrier_avg_rating: float | None = None
    carrier_review_count: int | None = None
    carrier_username: str | None = None
    weight_unit: str | None = None
    currency: str | None = None
    model_config = {"from_attributes": False}
