from pydantic import BaseModel
from datetime import datetime
import uuid


class FlightTrackingResponse(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    flight_number: str
    airline: str | None
    status: str
    departure_scheduled: datetime | None
    departure_actual: datetime | None
    arrival_estimated: datetime | None
    arrival_actual: datetime | None
    last_checked_at: datetime | None

    model_config = {"from_attributes": True}


class SetFlightRequest(BaseModel):
    flight_number: str
    airline: str | None = None
