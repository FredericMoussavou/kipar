from pydantic import BaseModel
import uuid
from datetime import datetime


class BookingCreate(BaseModel):
    trip_id: uuid.UUID
    receiver_email_or_phone: str
    weight_kg: float
    content_description: str
    declared_value: float = 0.0
    insurance_subscribed: bool = False


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

    model_config = {"from_attributes": True}


class BookingDetailResponse(BaseModel):
    """Réservation enrichie avec toutes les infos pour l'écran détail."""
    id: uuid.UUID
    trip_id: uuid.UUID
    package_id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID | None
    amount: float
    insurance_subscribed: bool
    status: str
    payment_rail: str | None
    # Package
    weight_kg: float | None = None
    content_description: str | None = None
    declared_value: float | None = None
    ai_scan_result: dict | None = None
    ai_prohibited_flag: bool | None = None
    # Trip
    origin_airport_code: str | None = None
    destination_airport_code: str | None = None
    departure_date: str | None = None
    flight_number: str | None = None
    # Carrier
    carrier_first_name: str | None = None
    carrier_last_name: str | None = None
    carrier_trust_score: float | None = None
    carrier_kyc_status: str | None = None
    # Receiver
    receiver_first_name: str | None = None
    receiver_last_name: str | None = None
    receiver_email: str | None = None
    # Sender
    sender_first_name: str | None = None
    sender_last_name: str | None = None
    sender_email: str | None = None

    model_config = {"from_attributes": False}
