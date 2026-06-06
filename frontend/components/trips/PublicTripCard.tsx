'use client'
import { Plane } from 'lucide-react'

const R = '#DC0029'
const CHARCOAL = '#1A1A1A'
const SAND = '#F5F2EE'
const TAUPE = '#8B8078'
const WHITE = '#FFFFFF'
const BORDER = 'rgba(0,0,0,0.08)'

export interface PublicTrip {
  id: string
  origin_city: string
  origin_airport_code: string
  destination_city: string
  destination_airport_code: string
  departure_date: string
  price_per_kg?: number | null
  small_package_price?: number | null
  remaining_kg?: number | null
  currency?: string | null
  weight_unit?: string | null
  trust_score?: number | null
  status: string
}

function trustColor(score: number) {
  if (score >= 75) return '#16A34A'
  if (score >= 50) return '#4ADE80'
  if (score >= 30) return '#F59E0B'
  return R
}

export default function PublicTripCard({ trip, onClick, smallLabel, kgLabel, trustLabel }: {
  trip: PublicTrip
  onClick: () => void
  smallLabel: string
  kgLabel: string
  trustLabel: string
}) {
  const score = Math.round(trip.trust_score ?? 0)
  const cur = trip.currency ?? 'EUR'
  const hasKg = trip.price_per_kg != null
  return (
    <div onClick={onClick} style={{
      flex: '0 0 auto', width: 280, background: WHITE, border: `1px solid ${BORDER}`,
      borderRadius: 18, padding: 20, cursor: 'pointer', boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.10)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.04)' }}
    >
      {/* Trajet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 17, fontWeight: 800, color: CHARCOAL, margin: 0, lineHeight: 1.1 }}>{trip.origin_city}</p>
          <p style={{ fontSize: 10, color: TAUPE, margin: '2px 0 0', letterSpacing: '0.05em' }}>{trip.origin_airport_code}</p>
        </div>
        <Plane size={16} color={R} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 17, fontWeight: 800, color: CHARCOAL, margin: 0, lineHeight: 1.1 }}>{trip.destination_city}</p>
          <p style={{ fontSize: 10, color: TAUPE, margin: '2px 0 0', letterSpacing: '0.05em' }}>{trip.destination_airport_code}</p>
        </div>
      </div>
      {/* Date + prix */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>{trip.departure_date}</p>
          {trip.remaining_kg != null && (
            <p style={{ fontSize: 11, color: TAUPE, margin: '2px 0 0' }}>{trip.remaining_kg} {trip.weight_unit ?? 'kg'} {kgLabel}</p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {hasKg ? (
            <>
              <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, color: CHARCOAL, margin: 0, lineHeight: 1 }}>{trip.price_per_kg} {cur}</p>
              <p style={{ fontSize: 10, color: TAUPE, margin: '2px 0 0' }}>/ {trip.weight_unit ?? 'kg'}</p>
            </>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, color: R, background: 'rgba(220,0,41,0.08)', borderRadius: 99, padding: '4px 10px' }}>{smallLabel}</span>
          )}
        </div>
      </div>
      {/* KiparTrust anonyme */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, color: TAUPE, minWidth: 24 }}>{trustLabel}</span>
        <div style={{ flex: 1, height: 4, background: SAND, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: trustColor(score), borderRadius: 99 }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: trustColor(score), minWidth: 24, textAlign: 'right' }}>{score}</span>
      </div>
    </div>
  )
}
