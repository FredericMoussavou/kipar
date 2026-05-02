'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Plane, Shield } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useBookingStore } from '@/stores/booking.store'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/kipar'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE } from '@/lib/theme'

function getTrustGradient(score: number) {
  if (score >= 75) return { gradient: 'linear-gradient(90deg,#F59E0B 0%,#4ADE80 60%,#16A34A 100%)', color: '#16A34A' }
  if (score >= 50) return { gradient: 'linear-gradient(90deg,#F59E0B 0%,#4ADE80 100%)', color: '#4ADE80' }
  if (score >= 30) return { gradient: 'linear-gradient(90deg,#DC0029 0%,#F59E0B 100%)', color: '#F59E0B' }
  return { gradient: 'linear-gradient(90deg,#DC0029 0%,#F97316 100%)', color: '#DC0029' }
}

export default function TripDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const { setSelectedTrip } = useBookingStore()
  const { isAuthenticated } = useAuthStore()

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: async () => {
      const res = await api.get(`/trips/${id}`)
      return res.data
    },
  })

  const handleBook = () => {
    if (!isAuthenticated()) { router.push('/login'); return }
    setSelectedTrip(trip)
    router.push(`/trips/${id}/book`)
  }

  if (isLoading) return (
    <div style={{ padding: '80px 20px 20px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: 100, background: WHITE, borderRadius: 16, border: `1px solid ${BORDER}`, marginBottom: 12 }} />
      ))}
    </div>
  )

  if (!trip) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: TAUPE }}>{t.trip.not_found}</p>
    </div>
  )

  const score = Math.round(trip.trust_score || 50)
  const { gradient, color } = getTrustGradient(score)

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>

      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80"
        minHeight={200}
        gradient="vertical"
      >
        <div style={{ padding: '48px 20px 28px', position: 'relative' }}>
          <button
            onClick={() => router.back()}
            style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} color="#fff" />
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>{t.trip.trip_detail}</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 36, fontWeight: 800, color: WHITE, lineHeight: 1 }}>{trip.origin_airport_code}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{trip.origin_city}</p>
            </div>
            <Plane size={22} color="rgba(255,255,255,0.5)" />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 36, fontWeight: 800, color: WHITE, lineHeight: 1 }}>{trip.destination_airport_code}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{trip.destination_city}</p>
            </div>
          </div>

          {trip.flight_number && (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
              ✈ {trip.flight_number} · {trip.departure_date}
              {trip.departure_time && ` · ${trip.departure_time}`}
              {trip.arrival_time && ` → ${trip.arrival_time}`}
            </p>
          )}
        </div>
      </HeroHeader>

      <div style={{ padding: '16px 16px 100px' }} className="md:max-w-2xl md:mx-auto">

        {/* Transporteur */}
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: CHARCOAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 16, fontWeight: 700, color: WHITE }}>K</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>{t.trip.kyc_verified}</p>
              <p style={{ fontSize: 12, color: TAUPE }}>{t.trip.verified_carrier}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, color: CHARCOAL, lineHeight: 1 }}>{trip.price_per_kg}€</p>
              <p style={{ fontSize: 11, color: TAUPE }}>{t.trip.price_per_kg}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: TAUPE, minWidth: 28 }}>Trust</span>
            <div style={{ flex: 1, height: 5, background: SAND, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: gradient, borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>
              KiparTrust {score}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          {[
            { label: t.trip.available_kg, value: `${trip.remaining_kg} kg` },
            { label: t.trip.max_per_package, value: `${trip.max_kg_per_package} kg` },
            { label: t.trip.departure, value: trip.departure_date?.slice(5) || '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 16, fontWeight: 700, color: CHARCOAL2, lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 10, color: TAUPE, marginTop: 4 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Assurance */}
        <div style={{ background: SAND, borderRadius: 14, padding: '12px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={18} color={CHARCOAL2} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL }}>{t.trip.insurance_available}</p>
            <p style={{ fontSize: 11, color: TAUPE, marginTop: 2 }}>{t.trip.insurance_desc}</p>
          </div>
        </div>

        <Button fullWidth size="lg" onClick={handleBook}>
          {t.trip.send_package}
        </Button>
      </div>
    </div>
  )
}