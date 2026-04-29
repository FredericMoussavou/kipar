from pydantic import BaseModel
import uuid


class PackageCreate(BaseModel):
    weight_kg: float
    content_description: str
    declared_value: float = 0.0


class PackageResponse(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID | None
    weight_kg: float
    content_description: str
    declared_value: float
    photo_urls: list
    ai_prohibited_flag: bool

    model_config = {"from_attributes": True}
