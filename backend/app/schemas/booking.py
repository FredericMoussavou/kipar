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
    reminder_hours: int | None = None
    photos: list[str] = []


class BookingUpdate(BaseModel):
    """Modification d'une reservation pending (champs optionnels)."""
    weight_kg: float | None = None
    content_description: str | None = None
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
    is_urgent: bool = False
    booking_flat_fee_amount: float = 1.5
    base_amount: float | None = None
    currency: str = "EUR"
    weight_unit: str = "kg"
    package_mode: str = "kg"
    ai_scan_result: dict | None = None
    ai_prohibited_flag: bool | None = None
    photo_urls: list | None = None
    # Trip
    origin_airport_code: str | None = None
    destination_airport_code: str | None = None
    departure_date: str | None = None
    departure_time: str | None = None
    arrival_date: str | None = None
    arrival_time: str | None = None
    flight_number: str | None = None
    # Carrier
    carrier_id: uuid.UUID | None = None
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
    # Annulation
    cancellation_reason: str | None = None
    # Pickup
    pickup_meeting_date: str | None = None
    proposed_pickup_date: str | None = None
    proposed_pickup_by: str | None = None
    pickup_reschedule_count: int = 0
    pickup_meeting_confirmed_by_sender: bool = False
    pickup_meeting_confirmed_by_carrier: bool = False
    pickup_code_plain: str | None = None
    pickup_qr_token: str | None = None
    # Delivery
    delivery_meeting_date: str | None = None
    proposed_delivery_date: str | None = None
    proposed_delivery_by: str | None = None
    delivery_reschedule_count: int = 0
    delivery_alternative_proof_url: str | None = None
    reminder_hours: int | None = None

    model_config = {"from_attributes": False}