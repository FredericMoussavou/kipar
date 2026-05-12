from pydantic import BaseModel
import uuid
from datetime import datetime


class DeliveryCodeResponse(BaseModel):
    booking_id: uuid.UUID
    code: str       # affiché au récepteur
    qr_token: str   # pour générer le QR code


class ValidateDeliveryRequest(BaseModel):
    code: str       # saisi par le transporteur


class ValidateDeliveryQRRequest(BaseModel):
    qr_token: str   # scanné par le transporteur

class PickupCodeResponse(BaseModel):
    booking_id: uuid.UUID
    code: str

class ValidatePickupRequest(BaseModel):
    code: str

class MeetingDateRequest(BaseModel):
    meeting_date: datetime

class AlternativeProofRequest(BaseModel):
    proof_url: str
