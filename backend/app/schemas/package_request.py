from pydantic import BaseModel, field_validator, model_validator, Field
from datetime import date, datetime
from typing import Literal
import uuid
from app.services.airport_service import validate_iata

class ApplicationResponse(BaseModel):
    id: uuid.UUID
    package_request_id: uuid.UUID
    carrier_id: uuid.UUID
    trip_id: uuid.UUID
    status: str
    created_at: datetime
    carrier_first_name: str | None = None
    carrier_last_name: str | None = None
    carrier_trust_score: float | None = None
    carrier_kyc_status: str | None = None
    trip_departure_date: date | None = None
    trip_price_per_kg: float | None = None
    trip_currency: str | None = None
    trip_weight_unit: str | None = None
    trip_flight_number: str | None = None
    model_config = {"from_attributes": False}

class PackageRequestCreate(BaseModel):
    package_mode: Literal["kg", "small"] = "kg"
    origin_city: str = Field(..., max_length=100)
    origin_airport_code: str = Field(..., max_length=10)
    destination_city: str = Field(..., max_length=100)
    destination_airport_code: str = Field(..., max_length=10)
    content_description: str = Field(..., max_length=500)
    weight_kg: float
    declared_value: float | None = None
    budget_per_kg: float
    photos: list[str] = []
    receiver_email_or_phone: str = Field(..., max_length=100)
    deadline_date: date

    @field_validator("origin_airport_code", "destination_airport_code")
    @classmethod
    def validate_iata_code(cls, v: str) -> str:
        code = v.upper().strip()
        if not validate_iata(code):
            raise ValueError(f"IATA_INVALID:{code}")
        return code

    @field_validator("deadline_date")
    @classmethod
    def future_date(cls, v: date) -> date:
        from datetime import date as d
        if v <= d.today():
            raise ValueError("La date limite doit etre dans le futur")
        return v

    @field_validator("weight_kg")
    @classmethod
    def positive_values(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("La valeur doit etre positive")
        if v > 100:
            raise ValueError("Le poids ne peut pas depasser 100 kg")
        return v

    @field_validator("budget_per_kg")
    @classmethod
    def budget_within_bounds(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Le budget doit etre positif")
        if v > 1000:
            raise ValueError("Le budget par kg ne peut pas depasser 1000")
        return v

    @field_validator("photos")
    @classmethod
    def photos_required(cls, v: list[str]) -> list[str]:
        if not v or len([p for p in v if p and p.strip()]) < 1:
            raise ValueError("PHOTOS_REQUIRED")
        return v

    @model_validator(mode="after")
    def check_budget_mode(self):
        if self.package_mode != "small" and self.budget_per_kg <= 0:
            raise ValueError("Le budget par kg doit etre positif")
        return self

    @field_validator("photos")
    @classmethod
    def max_photos(cls, v: list) -> list:
        if len(v) > 3:
            raise ValueError("Maximum 3 photos")
        return v

class PackageRequestResponse(BaseModel):
    package_mode: str = "kg"
    id: uuid.UUID
    sender_id: uuid.UUID
    origin_city: str
    origin_airport_code: str
    destination_city: str
    destination_airport_code: str
    content_description: str
    weight_kg: float
    declared_value: float | None = None
    budget_per_kg: float
    photos: list[str] = []
    receiver_email_or_phone: str
    deadline_date: date
    status: str
    created_at: datetime
    sender_first_name: str | None = None
    sender_last_name: str | None = None
    sender_trust_score: float | None = None
    applications_count: int = 0
    has_applied: bool = False
    model_config = {"from_attributes": False}
