from pydantic import BaseModel
from datetime import datetime
import uuid


class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    sender_id: uuid.UUID
    carrier_id: uuid.UUID
    created_at: datetime
    messages: list[MessageResponse] = []

    model_config = {"from_attributes": True}
