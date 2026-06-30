from pydantic import BaseModel, Field, field_validator
from typing import Literal
import uuid
from datetime import datetime

class BookingCreate(BaseModel):
    disclaimer_accepted: bool = False
    trip_id: uuid.UUID
    receiver_email_or_phone: str = Field(..., max_length=100)
    weight_kg: float
    content_description: str = Field(..., max_length=500)
    declared_value: float = 0.0
    insurance_subscribed: bool = False
    reminder_hours: int | None = None
    photos: list[str] = []

    @field_validator("photos")
    @classmethod
    def max_photos(cls, v: list) -> list:
        if len(v) > 5:
            raise ValueError("Maximum 5 photos autorisées")
        return v

    @field_validator("photos")
    @classmethod
    def photos_required(cls, v: list) -> list:
        if not v or len([p for p in v if p and str(p).strip()]) < 1:
            raise ValueError("PHOTOS_REQUIRED")
        return v

    @field_validator("weight_kg")
    @classmethod
    def weight_within_bounds(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("La valeur doit etre positive")
        if v > 100:
            raise ValueError("Le poids ne peut pas depasser 100 kg")
        return v

class BookingUpdate(BaseModel):
    weight_kg: float | None = None
    content_description: str | None = Field(None, max_length=500)
    declared_value: float | None = None
    insurance_subscribed: bool | None = None

class BookingResponse(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    package_id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID | None
    amount: float
    insurance_subscribed: bool
    status: str
    payment_rail: str | None
    weight_kg: float | None = None
    content_description: str | None = None
    declared_value: float | None = None
    is_urgent: bool = False
    booking_flat_fee_amount: float = 1.5
    base_amount: float | None = None
    currency: str = "EUR"
    weight_unit: str = "kg"
    package_mode: str = "kg"
    payment_deadline: datetime | None = None
    acceptance_deadline: datetime | None = None

    model_config = {"from_attributes": True}

class BookingDetailResponse(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    package_id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID | None
    amount: float
    insurance_subscribed: bool
    status: str
    payment_rail: str | None
    weight_kg: float | None = None
    content_description: str | None = None
    declared_value: float | None = None
    is_urgent: bool = False
    booking_flat_fee_amount: float = 1.5
    base_amount: float | None = None
    currency: str = "EUR"
    weight_unit: str = "kg"
    package_mode: str = "kg"
    ai_scan_result: dict | None = None
    ai_prohibited_flag: bool | None = None
    photo_urls: list | None = None
    origin_airport_code: str | None = None
    destination_airport_code: str | None = None
    departure_date: str | None = None
    departure_time: str | None = None
    arrival_date: str | None = None
    arrival_time: str | None = None
    flight_number: str | None = None
    carrier_id: uuid.UUID | None = None
    carrier_first_name: str | None = None
    carrier_last_name: str | None = None
    carrier_trust_score: float | None = None
    carrier_kyc_status: str | None = None
    receiver_first_name: str | None = None
    receiver_last_name: str | None = None
    receiver_email: str | None = None
    receiver_email_or_phone: str | None = None
    sender_first_name: str | None = None
    sender_last_name: str | None = None
    sender_email: str | None = None
    cancellation_reason: str | None = None
    pickup_meeting_date: str | None = None
    proposed_pickup_date: str | None = None
    proposed_pickup_by: str | None = None
    pickup_reschedule_count: int = 0
    pickup_meeting_confirmed_by_sender: bool = False
    pickup_meeting_confirmed_by_carrier: bool = False
    pickup_code_plain: str | None = None
    pickup_qr_token: str | None = None
    delivery_meeting_date: str | None = None
    proposed_delivery_date: str | None = None
    proposed_delivery_by: str | None = None
    delivery_reschedule_count: int = 0
    delivery_alternative_proof_url: str | None = None
    reminder_hours: int | None = None

    model_config = {"from_attributes": False}
