'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, Plane, Check, X, ChevronRight, Package } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import { Button } from '@/components/ui/kipar'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import api from '@/lib/api'
import { RED, CHARCOAL, TAUPE, SAND, BORDER, WHITE } from '@/lib/theme'

export default function CarrierPage() {
  const { t } = useTranslation()
  const { user, setUser } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: myTrips = [], isLoading: loadingTrips } = useQuery({
    queryKey: ['my-trips'],
    enabled: !!user?.is_carrier,
    queryFn: async () => {
      const res = await api.get('/trips?mine=true')
      return res.data
    },
  })

  const { data: allBookings = [] } = useQuery({
    queryKey: ['all-bookings-detail'],
    enabled: !!user?.is_carrier && myTrips.length > 0,
    queryFn: async () => {
      const res = await api.get('/bookings/detail')
      return res.data
    },
  })

  const pendingBookings = allBookings.filter(
    (b: any) => b.status === 'pending' && myTrips.some((tr: any) => tr.id === b.trip_id)
  )

  const activateMutation = useMutation({
    mutationFn: () => api.patch('/users/me', { is_carrier: true }),
    onSuccess: async () => {
      const me = await api.get('/users/me')
      setUser(me.data)
      toast.success('Mode transporteur activé !')
      queryClient.invalidateQueries({ queryKey: ['my-trips'] })
    },
    onError: () => toast.error(t.errors.generic),
  })

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/accept`),
    onSuccess: () => {
      toast.success('Réservation acceptée !')
      queryClient.invalidateQueries({ queryKey: ['all-bookings-detail'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const refuseMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/refuse`),
    onSuccess: () => {
      toast.success('Réservation refusée.')
      queryClient.invalidateQueries({ queryKey: ['all-bookings-detail'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  // — Onboarding —
  if (!user?.is_carrier) {
    return (
      <div style={{ minHeight: '100vh', background: 'rgba(240,237,232,0.2)' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '0 0 24px 24px', minHeight: 200 }}>
          <img
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80"
            alt="hero"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(220,0,41,0.88) 0%, rgba(60,0,15,0.75) 100%)' }} />
          <div style={{ position: 'relative', zIndex: 1, padding: '56px 24px 32px', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 26, fontWeight: 800, color: WHITE, marginBottom: 8 }}>
              {t.carrier.onboarding_title}
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', maxWidth: 300, margin: '0 auto' }}>
              {t.carrier.onboarding_sub}
            </p>
          </div>
        </div>

        <div style={{ padding: '32px 24px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {[
            { num: '1', label: t.carrier.step1 },
            { num: '2', label: t.carrier.step2 },
            { num: '3', label: t.carrier.step3 },
          ].map(step => (
            <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', maxWidth: 360, marginBottom: 12, background: WHITE, border: '1px solid ' + BORDER, borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {step.num}
              </div>
              <span style={{ fontSize: 14, color: CHARCOAL, fontWeight: 500 }}>{step.label}</span>
            </div>
          ))}

          {user?.kyc_status !== 'verified' && (
            <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 12, padding: '10px 16px', margin: '8px 0 16px', maxWidth: 360, width: '100%' }}>
              <p style={{ fontSize: 13, color: '#F59E0B', fontWeight: 500 }}>{t.carrier.onboarding_kyc}</p>
            </div>
          )}

          <div style={{ width: '100%', maxWidth: 360, marginTop: 8 }}>
            <Button fullWidth size="lg" loading={activateMutation.isPending}
              onClick={() => activateMutation.mutate()}
              disabled={user?.kyc_status !== 'verified'}>
              {t.carrier.onboarding_btn}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // — Dashboard transporteur —
  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>

      {/* Hero */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '0 0 24px 24px', minHeight: 160 }} className="md:rounded-[20px] md:mb-6">
        <img
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80"
          alt="hero"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(220,0,41,0.92) 0%, rgba(60,0,15,0.70) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '48px 20px 24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, color: WHITE, marginBottom: 4 }}>
              {t.carrier.dashboard_title}
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              {user?.first_name} {user?.last_name} · KiparTrust {Math.round(user?.trust_score || 50)}
            </p>
          </div>
          <button
            onClick={() => router.push('/carrier/new-trip')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: WHITE, border: 'none', borderRadius: 99, padding: '10px 20px', fontSize: 13, fontWeight: 700, color: RED, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
            <Plus size={14} />
            {t.carrier.new_trip}
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 20px 80px' }}>

        {/* Réservations en attente */}
        <p style={{ fontSize: 11, fontWeight: 700, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          {t.carrier.pending_bookings}
        </p>
        {pendingBookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER, marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: SAND, marginBottom: 10 }}>
              <Package size={24} color={TAUPE} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, marginBottom: 4 }}>{t.carrier.no_bookings}</p>
            <p style={{ fontSize: 13, color: TAUPE }}>{t.carrier.no_bookings_sub}</p>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            {pendingBookings.map((booking: any) => (
              <div key={booking.id} style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>{booking.content_description || 'Colis'}</p>
                    <p style={{ fontSize: 12, color: TAUPE, marginTop: 2 }}>{booking.weight_kg} kg · {booking.amount?.toFixed(2)}€</p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => acceptMutation.mutate(booking.id)} disabled={acceptMutation.isPending}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 99, background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#059669', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <Check size={14} /> {t.carrier.accept}
                  </button>
                  <button onClick={() => refuseMutation.mutate(booking.id)} disabled={refuseMutation.isPending}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 99, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <X size={14} /> {t.carrier.refuse}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mes annonces */}
        <p style={{ fontSize: 11, fontWeight: 700, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          {t.carrier.my_trips}
        </p>
        {loadingTrips ? (
          <div style={{ height: 80, background: WHITE, borderRadius: 14, border: '1px solid ' + BORDER }} />
        ) : myTrips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: SAND, marginBottom: 10 }}>
              <Plane size={24} color={TAUPE} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, marginBottom: 4 }}>{t.carrier.no_trips}</p>
            <p style={{ fontSize: 13, color: TAUPE }}>{t.carrier.no_trips_sub}</p>
          </div>
        ) : (
          myTrips.map((trip: any) => (
            <div key={trip.id} style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 18, fontWeight: 800, color: CHARCOAL }}>{trip.origin_airport_code}</span>
                  <Plane size={14} color={TAUPE} />
                  <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 18, fontWeight: 800, color: CHARCOAL }}>{trip.destination_airport_code}</span>
                </div>
                <p style={{ fontSize: 12, color: TAUPE }}>{trip.departure_date} · {trip.remaining_kg} kg dispo · {trip.price_per_kg}€/kg</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusBadge status={trip.status} />
                <ChevronRight size={16} color={TAUPE} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}