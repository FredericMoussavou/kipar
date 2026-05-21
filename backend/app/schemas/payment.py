from pydantic import BaseModel
import uuid


class PaymentIntentResponse(BaseModel):
    booking_id: uuid.UUID
    client_secret: str      # envoyé au frontend pour finaliser le paiement Stripe
    amount: float
    currency: str
    payment_rail: str


class PawapayPaymentResponse(BaseModel):
    booking_id: uuid.UUID
    deposit_id: str         # UUID PawaPay pour tracking
    amount: float
    currency: str
    payment_rail: str
    status: str             # ACCEPTED | FAILED


class WebhookResponse(BaseModel):
    status: str
