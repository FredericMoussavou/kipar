from pydantic import BaseModel
import uuid


class PaymentIntentResponse(BaseModel):
    booking_id: uuid.UUID
    client_secret: str      # envoyé au frontend pour finaliser le paiement Stripe
    amount: float
    currency: str
    payment_rail: str


class FlutterwavePaymentResponse(BaseModel):
    booking_id: uuid.UUID
    payment_link: str       # lien de paiement Flutterwave
    amount: float
    currency: str
    payment_rail: str


class WebhookResponse(BaseModel):
    status: str
