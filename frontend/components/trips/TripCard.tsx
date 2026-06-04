'use client'
import { Calendar } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, RED } from '@/lib/theme'
import { getTrustGradient } from '@/lib/trust'
import { WeightDisplay } from '@/components/ui/kipar/WeightDisplay'
import { PricePerWeightDisplay } from '@/components/ui/kipar/PricePerWeightDisplay'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { useConfig } from '@/hooks/useConfig'

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
  remaining_kg: number | null
  max_kg_per_package: number | null
  price_per_kg: number | null
  small_package_price?: number | null
  weight_unit?: string
  currency?: string
  trust_score?: number
  status: string
  carrier_id?: string
  carrier_first_name?: string
  carrier_last_name?: string
  carrier_username?: string
  carrier_avatar_url?: string | null
  accepts_urgent?: boolean
}

export default function TripCard({ trip, onClick, className }: {
  trip: Trip; onClick: () => void; className?: string
}) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const score = Math.round(trip.trust_score || 0)
  const { gradient, color } = getTrustGradient(score)
  const tripUnit = (trip.weight_unit || 'kg') as 'kg' | 'lb' | 'g'
  const userUnit = (user?.weight_unit || 'kg') as 'kg' | 'lb' | 'g'
  const tripCurrency = trip.currency || 'EUR'
  const userCurrency = user?.currency || 'EUR'
  const rates = useExchangeRates()
  const config = useConfig()
  const initials = `${trip.carrier_first_name?.[0] ?? ''}${trip.carrier_last_name?.[0] ?? ''}`.toUpperCase()

  return (
    <div onClick={onClick} className={className}
      style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(220,0,41,0.2)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLDivElement).style.borderColor = BORDER }}
    >
      {/* Header : transporteur + prix */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        {/* Avatar + nom */}
        <Link href={trip.carrier_id ? `/profile/${trip.carrier_id}` : '#'} onClick={e => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: CHARCOAL, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {trip.carrier_avatar_url
              ? <img src={trip.carrier_avatar_url} style={{ width: 32, height: 32, objectFit: 'cover' }} alt="" />
              : <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 11, fontWeight: 700, color: WHITE }}>{initials || 'K'}</span>}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL, margin: 0, lineHeight: 1.2 }}>
              {trip.carrier_first_name}{trip.carrier_last_name ? ` ${trip.carrier_last_name[0]}.` : ''}
            </p>
            {trip.carrier_username && (
              <p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>@{trip.carrier_username}</p>
            )}
          </div>
        </Link>
        {/* Prix */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ textAlign: 'right' }}>
            {trip.price_per_kg != null ? (
              <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 16, fontWeight: 800, color: CHARCOAL, lineHeight: 1, margin: 0 }}>
                <PricePerWeightDisplay price={trip.price_per_kg} currency={tripCurrency} unit={tripUnit} userCurrency={userCurrency} userUnit={userUnit} rates={rates ?? undefined} />
              </p>
            ) : (
              <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 13, fontWeight: 700, color: '#92400E', lineHeight: 1, margin: 0 }}>
                {t.trip.small_package_only}
              </p>
            )}
            {trip.small_package_price != null && (
              <p style={{ fontSize: 11, color: '#92400E', background: '#FFF3CD', border: '1px solid #FFE082', borderRadius: 99, padding: '2px 8px', margin: '4px 0 0', display: 'inline-block', fontWeight: 600 }}>
                📦 Petit colis : {trip.small_package_price + config.small_package.kipar_fee}€
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Route */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, color: CHARCOAL, lineHeight: 1, margin: 0 }}>{trip.origin_airport_code}</p>
          <p style={{ fontSize: 10, color: TAUPE, marginTop: 2 }}>{trip.origin_city}</p>
          {trip.departure_time && <p style={{ fontSize: 11, fontWeight: 600, color: CHARCOAL2, marginTop: 2 }}>{trip.departure_time}</p>}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: SAND, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✈</div>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, color: CHARCOAL, lineHeight: 1, margin: 0 }}>{trip.destination_airport_code}</p>
          <p style={{ fontSize: 10, color: TAUPE, marginTop: 2 }}>{trip.destination_city}</p>
          {trip.arrival_time && <p style={{ fontSize: 11, fontWeight: 600, color: CHARCOAL2, marginTop: 2 }}>{trip.arrival_time}</p>}
        </div>
      </div>

      {/* Meta : date + vol */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: TAUPE, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={12} />
          <span>{trip.departure_date}</span>
        </div>
        {trip.flight_number && <span>✈ {trip.flight_number}</span>}
      </div>

      {/* Tags capacité */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {trip.accepts_urgent && (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: '#FFF3CD', color: '#92400E', fontWeight: 700, border: '1px solid #FFE082' }}>
            ⚡ Urgent
          </span>
        )}
        {trip.remaining_kg != null && (
          <>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: SAND, color: CHARCOAL2, fontWeight: 600 }}>
              <WeightDisplay value={trip.remaining_kg} unit={tripUnit} userUnit={userUnit} showConversion={tripUnit !== userUnit} /> {t.trip.available_kg}
            </span>
            {trip.max_kg_per_package != null && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: SAND, color: CHARCOAL2, fontWeight: 500 }}>
                max <WeightDisplay value={trip.max_kg_per_package} unit={tripUnit} userUnit={userUnit} showConversion={tripUnit !== userUnit} />
              </span>
            )}
          </>
        )}
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
