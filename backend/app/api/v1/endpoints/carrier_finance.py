from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta, date
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.booking import Booking
from app.models.trip import Trip
from app.models.package import Package
from app.core.config import settings

router = APIRouter(prefix="/carrier", tags=["carrier-finance"])

MAX_HISTORY_YEARS = 5


@router.get("/finance")
async def get_carrier_finance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period: str = Query("month"),   # day / week / month / year / all
    year: int = Query(None),        # annee civile pour section fiscale
):
    """Tableau de bord financier du transporteur."""
    now = datetime.now(timezone.utc)
    # Penalites (dette + releve) - independant des trips
    from app.models.penalty_ledger import PenaltyLedger
    penalty_balance = round(current_user.penalty_balance or 0.0, 2)
    _led_res = await db.execute(
        select(PenaltyLedger).where(PenaltyLedger.carrier_id == current_user.id).order_by(PenaltyLedger.created_at.desc())
    )
    penalty_ledger = [
        {
            "id": str(e.id),
            "date": e.created_at.isoformat(),
            "amount": round(e.amount, 2),
            "entry_type": e.entry_type,
            "balance_after": round(e.balance_after, 2),
            "description": e.description,
            "booking_id": str(e.booking_id) if e.booking_id else None,
        }
        for e in _led_res.scalars().all()
    ]
    # Releve des versements (payouts) du transporteur
    from app.models.payout_ledger import PayoutLedger
    _pay_res = await db.execute(
        select(PayoutLedger).where(PayoutLedger.carrier_id == current_user.id).order_by(PayoutLedger.created_at.desc())
    )
    _payout_rows = _pay_res.scalars().all()
    payout_ledger = [
        {
            "id": str(p.id),
            "date": p.created_at.isoformat(),
            "amount": round(p.amount, 2),
            "currency": p.currency,
            "rail": p.rail,
            "status": p.status,
            "failure_reason": p.failure_reason,
            "booking_id": str(p.booking_id),
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        }
        for p in _payout_rows
    ]
    payouts_pending_total = round(sum(p.amount for p in _payout_rows if p.status == "pending"), 2)
    payouts_paid_total = round(sum(p.amount for p in _payout_rows if p.status == "paid"), 2)
    payouts_summary = {
        "pending_total": payouts_pending_total,
        "paid_total": payouts_paid_total,
        "pending_count": sum(1 for p in _payout_rows if p.status == "pending"),
    }
    min_date = now - timedelta(days=365 * MAX_HISTORY_YEARS)

    # Periode filtre
    if period == "day":
        since = now - timedelta(days=1)
    elif period == "week":
        since = now - timedelta(days=7)
    elif period == "year":
        since = now - timedelta(days=365)
    elif period == "all":
        since = min_date
    else:  # month par defaut
        since = now - timedelta(days=30)

    # Trips du transporteur
    trips_result = await db.execute(
        select(Trip).where(Trip.carrier_id == current_user.id)
    )
    all_trips = trips_result.scalars().all()
    trip_ids = [t.id for t in all_trips]

    if not trip_ids:
        return _empty_response(period, now, penalty_balance, penalty_ledger)

    # Bookings sur ces trips dans la periode
    bookings_result = await db.execute(
        select(Booking).where(
            Booking.trip_id.in_(trip_ids),
            Booking.created_at >= since,
            Booking.created_at >= min_date,
        )
    )
    bookings = bookings_result.scalars().all()

    # Categorisation
    delivered = [b for b in bookings if b.status == "delivered"]
    in_escrow = [b for b in bookings if b.status in ("paid", "in_transit", "accepted")]
    disputed = [b for b in bookings if b.status == "disputed"]
    cancelled = [b for b in bookings if b.status in (
        "cancelled", "cancelled_by_sender", "cancelled_by_carrier", "refunded"
    )]

    # Revenus encaisses = montant - commission Kipar (sender 15% + carrier 2%)
    kipar_rate = settings.SERVICE_FEE_SENDER_PERCENT + settings.SERVICE_FEE_CARRIER_PERCENT
    carrier_rate = 1 - kipar_rate  # ce que le transporteur recoit (legacy, affichage taux)

    from app.services.pricing_service import compute_carrier_payout
    def carrier_net(b: Booking) -> float:
        # Versement reel (Modele A) : base-2% (kg) ou base entiere (small)
        return compute_carrier_payout(b)

    revenue_collected = sum(carrier_net(b) for b in delivered)
    revenue_pending = sum(b.amount for b in in_escrow)
    revenue_disputed = sum(b.amount for b in disputed)

    # Historique detaille
    trip_map = {t.id: t for t in all_trips}
    pkg_ids = [b.package_id for b in bookings]
    pkgs_res = await db.execute(select(Package).where(Package.id.in_(pkg_ids)))
    pkg_map = {p.id: p for p in pkgs_res.scalars().all()}
    transactions = []
    for b in sorted(bookings, key=lambda x: x.created_at, reverse=True):
        trip = trip_map.get(b.trip_id)
        pkg = pkg_map.get(b.package_id)

        # Calcul remboursement annulation
        refund_type = None
        if b.status in ("cancelled", "cancelled_by_sender", "cancelled_by_carrier", "refunded"):
            if b.paid_at and trip and trip.departure_date:
                dep_dt = datetime.combine(trip.departure_date, datetime.min.time()).replace(tzinfo=timezone.utc)
                hours_before = (dep_dt - b.paid_at).total_seconds() / 3600
                if hours_before > settings.LATE_CANCEL_HOURS:
                    refund_type = "full"
                elif hours_before > 0:
                    refund_type = "partial"
                else:
                    refund_type = "none"

        transactions.append({
            "id": str(b.id),
            "date": b.created_at.isoformat(),
            "status": b.status,
            "amount_gross": round(b.amount, 2),
            "kipar_commission": round(b.amount - carrier_net(b), 2),
            "amount_net": carrier_net(b) if b.status == "delivered" else None,
            "currency": b.currency,
            "payment_rail": b.payment_rail,
            "origin": trip.origin_airport_code if trip else None,
            "destination": trip.destination_airport_code if trip else None,
            "departure_date": trip.departure_date.isoformat() if trip else None,
            "flight_number": trip.flight_number if trip else None,
            "content_description": pkg.content_description if pkg else None,
            "weight_kg": pkg.weight_kg if pkg else None,
            "insurance_subscribed": b.insurance_subscribed,
            "refund_type": refund_type,
            "delivery_confirmed_at": b.delivery_confirmed_at.isoformat() if b.delivery_confirmed_at else None,
        })

    # Section fiscale — annees civiles sur 5 ans
    fiscal_years = []
    current_year = now.year
    for y in range(current_year, current_year - MAX_HISTORY_YEARS, -1):
        start = datetime(y, 1, 1, tzinfo=timezone.utc)
        end = datetime(y, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
        year_bookings_result = await db.execute(
            select(Booking).where(
                Booking.trip_id.in_(trip_ids),
                Booking.status == "delivered",
                Booking.delivery_confirmed_at >= start,
                Booking.delivery_confirmed_at <= end,
            )
        )
        year_bookings = year_bookings_result.scalars().all()
        gross = round(sum(b.amount for b in year_bookings), 2)
        net = round(sum(carrier_net(b) for b in year_bookings), 2)
        fiscal_years.append({
            "year": y,
            "gross": gross,
            "net": net,
            "commission_paid": round(gross - net, 2),
            "deliveries_count": len(year_bookings),
            "is_current": y == current_year,
        })

    # Serie temporelle
    from collections import defaultdict
    series: dict = defaultdict(lambda: {"net": 0.0, "gross": 0.0, "count": 0})
    for b in delivered:
        if period == "day":
            key = b.created_at.strftime("%H:00")
        elif period == "year":
            key = b.created_at.strftime("%b %Y")
        else:
            key = b.created_at.strftime("%d/%m")
        series[key]["gross"] += b.amount
        series[key]["net"] += carrier_net(b)
        series[key]["count"] += 1

    chart = [
        {"label": k, "gross": round(v["gross"], 2), "net": round(v["net"], 2), "count": v["count"]}
        for k, v in sorted(series.items())
    ]

    return {
        "period": period,
        "since": since.isoformat(),
        "kipar_rate_percent": round(kipar_rate * 100, 1),
        "summary": {
            "revenue_collected": round(revenue_collected, 2),
            "revenue_pending": round(revenue_pending, 2),
            "revenue_disputed": round(revenue_disputed, 2),
            "delivered_count": len(delivered),
            "in_escrow_count": len(in_escrow),
            "disputed_count": len(disputed),
            "cancelled_count": len(cancelled),
        },
        "fiscal_years": fiscal_years,
        "transactions": transactions,
        "chart": chart,
        "penalty_balance": penalty_balance,
        "penalty_ledger": penalty_ledger,
        "payouts_summary": payouts_summary,
        "payout_ledger": payout_ledger,
    }


def _empty_response(period: str, now: datetime, penalty_balance: float = 0.0, penalty_ledger: list = None) -> dict:
    current_year = now.year
    return {
        "period": period,
        "since": now.isoformat(),
        "kipar_rate_percent": round(
            (settings.SERVICE_FEE_SENDER_PERCENT + settings.SERVICE_FEE_CARRIER_PERCENT) * 100, 1
        ),
        "summary": {
            "revenue_collected": 0.0,
            "revenue_pending": 0.0,
            "revenue_disputed": 0.0,
            "delivered_count": 0,
            "in_escrow_count": 0,
            "disputed_count": 0,
            "cancelled_count": 0,
        },
        "fiscal_years": [
            {"year": y, "gross": 0.0, "net": 0.0, "commission_paid": 0.0,
             "deliveries_count": 0, "is_current": y == current_year}
            for y in range(current_year, current_year - 5, -1)
        ],
        "transactions": [],
        "chart": [],
        "penalty_balance": round(penalty_balance or 0.0, 2),
        "penalty_ledger": penalty_ledger or [],
        "payouts_summary": {"pending_total": 0.0, "paid_total": 0.0, "pending_count": 0},
        "payout_ledger": [],
    }