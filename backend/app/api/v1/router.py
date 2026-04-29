from fastapi import APIRouter
from app.api.v1.endpoints import auth, trips, bookings, messages, delivery

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(trips.router)
api_router.include_router(bookings.router)
api_router.include_router(messages.router)
api_router.include_router(delivery.router)
