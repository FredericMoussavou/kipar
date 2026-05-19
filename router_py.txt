from fastapi import APIRouter
from app.api.v1.endpoints.receiver import router as receiver_router
from app.api.v1.endpoints.premium import router as premium_router
from app.api.v1.endpoints.carrier_finance import router as carrier_finance_router
from app.api.v1.endpoints.carrier_finance import router as carrier_finance_router
from app.api.v1.endpoints import (
    auth, trips, bookings, messages,
    delivery, tracking, payments, users, kyc, reviews,
    kiparscan, pir, insurance, airports, oauth, requests, notifications, verify, admin,
    currencies
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(oauth.router)
api_router.include_router(users.router)
api_router.include_router(airports.router)
api_router.include_router(trips.router)
api_router.include_router(bookings.router)
api_router.include_router(messages.router)
api_router.include_router(delivery.router)
api_router.include_router(tracking.router)
api_router.include_router(payments.router)
api_router.include_router(kyc.router)
api_router.include_router(reviews.router)
api_router.include_router(kiparscan.router)
api_router.include_router(pir.router)
api_router.include_router(insurance.router)
api_router.include_router(requests.router)
api_router.include_router(notifications.router)
api_router.include_router(carrier_finance_router)
api_router.include_router(carrier_finance_router)
api_router.include_router(verify.router)
api_router.include_router(premium_router)
api_router.include_router(receiver_router)
api_router.include_router(admin.router)
api_router.include_router(currencies.router)
