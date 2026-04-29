from pydantic import BaseModel, model_validator
import uuid

BOOKING_STATUS_LABELS = {
    "fr": {
        "awaiting_receiver": "En attente du récepteur",
        "pending": "En attente d'acceptation",
        "accepted": "Accepté",
        "refused": "Refusé",
        "paid": "Payé",
        "in_transit": "En transit",
        "delivered": "Livré",
        "disputed": "Litige ouvert",
        "refunded": "Remboursé",
    },
    "en": {
        "awaiting_receiver": "Awaiting receiver",
        "pending": "Pending approval",
        "accepted": "Accepted",
        "refused": "Refused",
        "paid": "Paid",
        "in_transit": "In transit",
        "delivered": "Delivered",
        "disputed": "Dispute opened",
        "refunded": "Refunded",
    }
}


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
    # Champs enrichis depuis Package
    weight_kg: float | None = None
    content_description: str | None = None
    declared_value: float | None = None

    model_config = {"from_attributes": True}
