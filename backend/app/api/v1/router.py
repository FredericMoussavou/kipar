from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, trips, bookings, messages,
    delivery, tracking, payments, users, kyc, reviews, kiparscan, claims
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(trips.router)
api_router.include_router(bookings.router)
api_router.include_router(messages.router)
api_router.include_router(delivery.router)
api_router.include_router(tracking.router)
api_router.include_router(payments.router)
api_router.include_router(kyc.router)
api_router.include_router(reviews.router)
api_router.include_router(kiparscan.router)
api_router.include_router(claims.router)
