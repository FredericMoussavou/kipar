'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, Plane, Package, Check, X, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import { Button } from '@/components/ui/kipar'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import api from '@/lib/api'

import { RED, CHARCOAL, TAUPE, SAND, BORDER } from '@/lib/theme'

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
      toast.success('Mode transporteur active !')
      queryClient.invalidateQueries({ queryKey: ['my-trips'] })
    },
    onError: () => toast.error(t.errors.generic),
  })

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/accept`),
    onSuccess: () => {
      toast.success('Reservation acceptee !')
      queryClient.invalidateQueries({ queryKey: ['all-bookings-detail'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const refuseMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/refuse`),
    onSuccess: () => {
      toast.success('Reservation refusee.')
      queryClient.invalidateQueries({ queryKey: ['all-bookings-detail'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  if (!user?.is_carrier) {
    return (
      <div style={{ minHeight: '100vh', background: '#FBFBFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: SAND, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Plane size={36} color={CHARCOAL} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 26, fontWeight: 800, color: CHARCOAL, textAlign: 'center', marginBottom: 12 }}>
          {t.carrier.onboarding_title}
        </h1>
        <p style={{ fontSize: 15, color: TAUPE, textAlign: 'center', maxWidth: 320, lineHeight: 1.6, marginBottom: 32 }}>
          {t.carrier.onboarding_sub}
        </p>
        {[
          { num: '1', label: 'Activez le mode transporteur' },
          { num: '2', label: 'Completez votre verification KYC' },
          { num: '3', label: 'Postez vos annonces de trajet' },
        ].map(step => (
          <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', maxWidth: 320, marginBottom: 12, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 16px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
              {step.num}
            </div>
            <span style={{ fontSize: 14, color: CHARCOAL, fontWeight: 500 }}>{step.label}</span>
          </div>
        ))}
        {user?.kyc_status !== 'verified' && (
          <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 12, padding: '10px 16px', marginTop: 16, marginBottom: 16, maxWidth: 320, width: '100%' }}>
            <p style={{ fontSize: 13, color: '#F59E0B', fontWeight: 500 }}>
              {t.carrier.onboarding_kyc}
            </p>
          </div>
        )}
        <div style={{ marginTop: 8, width: '100%', maxWidth: 320 }}>
          <Button
            fullWidth
            size="lg"
            loading={activateMutation.isPending}
            onClick={() => activateMutation.mutate()}
            disabled={user?.kyc_status !== 'verified'}
          >
            {t.carrier.onboarding_btn}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#FBFBFF', minHeight: '100vh' }}>
      <div style={{ background: RED, padding: '48px 20px 24px', color: '#fff' }}>
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          {t.carrier.dashboard_title}
        </h1>
        <p style={{ fontSize: 13, opacity: 0.8 }}>
          {user?.first_name} {user?.last_name} · KiparTrust {Math.round(user?.trust_score || 50)}
        </p>
      </div>

      <div style={{ padding: '20px 20px 80px' }}>

        <button
          onClick={() => router.push('/carrier/new-trip')}
          style={{ width: '100%', background: '#fff', border: `2px dashed ${BORDER}`, borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', marginBottom: 24 }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = RED)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
        >
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={16} color="#fff" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: CHARCOAL }}>{t.carrier.new_trip}</span>
        </button>

        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            {t.carrier.pending_bookings}
          </p>
          {pendingBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}` }}>
              <p style={{ color: TAUPE, fontSize: 13 }}>{t.carrier.no_bookings}</p>
            </div>
          ) : (
            pendingBookings.map((booking: any) => (
              <div key={booking.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>{booking.content_description || 'Colis'}</p>
                    <p style={{ fontSize: 12, color: TAUPE, marginTop: 2 }}>
                      {booking.weight_kg} kg · {booking.amount?.toFixed(2)}€
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => acceptMutation.mutate(booking.id)}
                    disabled={acceptMutation.isPending}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 99, background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#059669', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Check size={14} /> {t.carrier.accept}
                  </button>
                  <button
                    onClick={() => refuseMutation.mutate(booking.id)}
                    disabled={refuseMutation.isPending}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 99, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <X size={14} /> {t.carrier.refuse}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            {t.carrier.my_trips}
          </p>
          {loadingTrips ? (
            <div style={{ height: 80, background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}` }} />
          ) : myTrips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}` }}>
              <p style={{ color: TAUPE, fontSize: 13 }}>{t.carrier.no_trips}</p>
            </div>
          ) : (
            myTrips.map((trip: any) => (
              <div key={trip.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
    </div>
  )
}
