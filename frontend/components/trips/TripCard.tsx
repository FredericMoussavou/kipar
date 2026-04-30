'use client'
import { Calendar } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER } from '@/lib/theme'

function getTrustGradient(score: number) {
  if (score >= 75) return { gradient: 'linear-gradient(90deg,#F59E0B 0%,#4ADE80 60%,#16A34A 100%)', color: '#16A34A' }
  if (score >= 50) return { gradient: 'linear-gradient(90deg,#F59E0B 0%,#4ADE80 100%)', color: '#4ADE80' }
  if (score >= 30) return { gradient: 'linear-gradient(90deg,#DC0029 0%,#F59E0B 100%)', color: '#F59E0B' }
  return { gradient: 'linear-gradient(90deg,#DC0029 0%,#F97316 100%)', color: '#DC0029' }
}

interface Trip {
  id: string
  origin_airport_code: string
  destination_airport_code: string
  origin_city: string
  destination_city: string
  departure_date: string
  departure_time?: string | null
  arrival_time?: string | null
  flight_number: string | null
  remaining_kg: number
  max_kg_per_package: number
  price_per_kg: number
  trust_score?: number
  status: string
}

export default function TripCard({ trip, onClick, className }: {
  trip: Trip; onClick: () => void; className?: string
}) {
  const { t } = useTranslation()
  const score = Math.round(trip.trust_score || 0)
  const { gradient, color } = getTrustGradient(score)

  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: '#fff',
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 16,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(220,0,41,0.2)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = BORDER
      }}
    >
      {/* Route */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, color: CHARCOAL, lineHeight: 1 }}>
            {trip.origin_airport_code}
          </p>
          <p style={{ fontSize: 10, color: TAUPE, marginTop: 2 }}>{trip.origin_city}</p>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: SAND, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✈</div>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, color: CHARCOAL, lineHeight: 1 }}>
            {trip.destination_airport_code}
          </p>
          <p style={{ fontSize: 10, color: TAUPE, marginTop: 2 }}>{trip.destination_city}</p>
        </div>
        <div style={{ marginLeft: 8, textAlign: 'right' }}>
          <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 18, fontWeight: 800, color: CHARCOAL, lineHeight: 1 }}>
            {trip.price_per_kg}€
          </p>
          <p style={{ fontSize: 10, color: TAUPE, marginTop: 2 }}>{t.trip.price_per_kg}</p>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: TAUPE, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={12} />
          <span>{trip.departure_date}</span>
        </div>
        {trip.departure_time && (
          <span style={{ fontWeight: 600, color: CHARCOAL2 }}>{trip.departure_time}{trip.arrival_time ? " → " + trip.arrival_time : ""}</span>
        )}
        {trip.flight_number && <span>✈ {trip.flight_number}</span>}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: SAND, color: CHARCOAL2, fontWeight: 600 }}>
          {trip.remaining_kg} kg dispo
        </span>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: SAND, color: CHARCOAL2, fontWeight: 500 }}>
          Max {trip.max_kg_per_package} kg
        </span>
      </div>

      {/* Trust */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: TAUPE, minWidth: 28 }}>Trust</span>
        <div style={{ flex: 1, height: 4, background: SAND, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: gradient, borderRadius: 99, transition: 'width 0.5s' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 24, textAlign: 'right' }}>{score}</span>
      </div>
    </div>
  )
}
