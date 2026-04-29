from pydantic import BaseModel
import uuid


class BookingCreate(BaseModel):
    trip_id: uuid.UUID
    receiver_email_or_phone: str  # email ou téléphone du récepteur
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

    model_config = {"from_attributes": True}
