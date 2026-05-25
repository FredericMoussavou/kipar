'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, Plane, Check, X, ChevronRight, Package, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import { Button } from '@/components/ui/kipar'
import Modal from '@/components/ui/kipar/Modal'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { RED, CHARCOAL, TAUPE, SAND, BORDER, WHITE } from '@/lib/theme'
import { useDrawerStore } from '@/stores/drawer.store'
import { useKyc } from '@/hooks/useKyc'

const HERO_IMG = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80'

export default function CarrierPage() {
  const { open: openDrawer } = useDrawerStore()
  const { t } = useTranslation()
  const { user, setUser } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'pending' | 'treated' | 'trips'>('pending')
  const [tripToDelete, setTripToDelete] = useState<{id: string, label: string} | null>(null)
  const [deliverModal, setDeliverModal] = useState<{bookingId: string} | null>(null)
  const [deliverCode, setDeliverCode] = useState('')
  const [delivering, setDelivering] = useState(false)
  const [deliverError, setDeliverError] = useState('')
  const [deletingTrip, setDeletingTrip] = useState(false)
  const kyc = useKyc()

  const { data: myTrips = [], isLoading: loadingTrips } = useQuery({
    queryKey: ['my-trips'],
    enabled: !!user?.is_carrier,
    queryFn: async () => {
      const res = await api.get('/trips?mine=true')
      return res.data
    },
  })

  const { data: allBookings = [] } = useQuery({
    queryKey: ['carrier-bookings'],
    enabled: !!user?.is_carrier,
    queryFn: async () => {
      const res = await api.get('/bookings/carrier')
      return res.data
    },
  })

  const pendingBookings = allBookings.filter((b: any) => ['pending', 'awaiting_receiver', 'paid'].includes(b.status))
  const treatedBookings = allBookings.filter((b: any) => !['pending', 'awaiting_receiver', 'paid'].includes(b.status))
  const deliverableBookings = treatedBookings.filter((b: any) => ['accepted', 'paid', 'in_transit'].includes(b.status))
  const refusedBookings = treatedBookings.filter((b: any) => b.status === 'refused')

  const activateMutation = useMutation({
    mutationFn: () => api.patch('/users/me', { is_carrier: true }),
    onSuccess: (res) => {
      setUser(res.data.user)
      toast.success('Mode transporteur activé !')
      queryClient.invalidateQueries({ queryKey: ['my-trips'] })
      queryClient.invalidateQueries({ queryKey: ['carrier-bookings'] })
    },
    onError: () => toast.error(t.errors.generic),
  })

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/accept`),
    onSuccess: () => {
      toast.success('Réservation acceptée !')
      queryClient.invalidateQueries({ queryKey: ['carrier-bookings'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const refuseMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/refuse`),
    onSuccess: () => {
      toast.success('Réservation refusée.')
      queryClient.invalidateQueries({ queryKey: ['carrier-bookings'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })


  // — Confirm delivery —
  const handleDeliver = async () => {
    if (!deliverModal) return
    setDelivering(true)
    setDeliverError('')
    try {
      await api.post(`/delivery/${deliverModal.bookingId}/validate`, { code: deliverCode })
      toast.success(t.delivery.delivered_toast)
      setDeliverModal(null)
      setDeliverCode('')
      queryClient.invalidateQueries({ queryKey: ['carrier-bookings'] })
    } catch {
      setDeliverError(t.delivery.invalid_code)
    } finally {
      setDelivering(false)
    }
  }

  // — Onboarding —
  if (!user?.is_carrier) {
    return (
      <div style={{ minHeight: '100vh', background: 'rgba(240,237,232,0.2)' }}>
        <HeroHeader onMenuOpen={openDrawer} imageUrl={HERO_IMG} minHeight={200} gradient="vertical">
          <div style={{ padding: '56px 24px 32px', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 26, fontWeight: 800, color: WHITE, marginBottom: 8 }}>
              {t.carrier.onboarding_title}
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', maxWidth: 300, margin: '0 auto' }}>
              {t.carrier.onboarding_sub}
            </p>
          </div>
        </HeroHeader>

        <div style={{ padding: '32px 24px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {[
            { num: '1', label: t.carrier.step1 },
            { num: '2', label: t.carrier.step2 },
            { num: '3', label: t.carrier.step3 },
          ].map(step => (
            <div key={step.num}
              onClick={step.num === '1' && user?.kyc_status !== 'approved' ? kyc.startKyc : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', maxWidth: 360, marginBottom: 12, background: WHITE, border: `1px solid ${step.num === '1' && user?.kyc_status !== 'approved' ? 'rgba(220,0,41,0.3)' : BORDER}`, borderRadius: 14, padding: '14px 16px', cursor: step.num === '1' && user?.kyc_status !== 'approved' ? 'pointer' : 'default' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: step.num === '1' && user?.kyc_status === 'approved' ? '#16A34A' : RED, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {step.num === '1' && user?.kyc_status === 'approved' ? '✓' : step.num}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, color: CHARCOAL, fontWeight: 500 }}>{step.label}</span>
                {step.num === '1' && user?.kyc_status !== 'approved' && (
                  <p style={{ fontSize: 11, color: RED, marginTop: 2, fontWeight: 600 }}>
                    {kyc.isLoading ? t.onboarding.kyc_waiting : t.profile_edit.kyc_action_verify}
                  </p>
                )}
                {step.num === '1' && user?.kyc_status === 'approved' && (
                  <p style={{ fontSize: 11, color: '#16A34A', marginTop: 2, fontWeight: 600 }}>{t.onboarding.kyc_verified}</p>
                )}
              </div>
            </div>
          ))}
          {user?.kyc_status !== 'approved' && (
            <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 12, padding: '10px 16px', margin: '8px 0 16px', maxWidth: 360, width: '100%' }}>
              <p style={{ fontSize: 13, color: '#F59E0B', fontWeight: 500 }}>{t.carrier.onboarding_kyc}</p>
            </div>
          )}
          <div style={{ width: '100%', maxWidth: 360, marginTop: 8 }}>
            <Button fullWidth size="lg" loading={activateMutation.isPending}
              onClick={() => activateMutation.mutate()}
              disabled={user?.kyc_status !== 'approved'}>
              {t.carrier.onboarding_btn}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    { key: 'pending' as const, label: t.carrier.tab_pending, count: pendingBookings.length },
    { key: 'treated' as const, label: t.carrier.tab_treated, count: treatedBookings.length },
    { key: 'trips' as const, label: t.carrier.tab_trips, count: myTrips.length },
  ]

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>

      <HeroHeader onMenuOpen={openDrawer} imageUrl={HERO_IMG} minHeight={180}>
        <div style={{ padding: '48px 24px 28px' }} className="md:p-8">
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, color: WHITE, marginBottom: 4 }}
            className="md:text-3xl">
            {t.carrier.dashboard_title}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 12 }}>
            {user?.first_name} {user?.last_name} · KiparTrust {Math.round(user?.trust_score || 50)}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/carrier/finance')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, color: WHITE, cursor: 'pointer' }}>
              Mes finances
            </button>
            <button onClick={() => router.push('/carrier/requests')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, color: WHITE, cursor: 'pointer' }}>
              {t.requests.carrier_requests}
            </button>
            <button onClick={() => router.push('/carrier/new-trip')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: RED, border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, color: '#ffffff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
              <Plus size={14} />
              {t.carrier.new_trip}
            </button>
          </div>
        </div>
      </HeroHeader>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 0, background: WHITE, borderBottom: '1px solid ' + BORDER, padding: '0 20px' }} className="md:px-0">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ flex: 1, padding: '14px 8px', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 400, color: activeTab === tab.key ? RED : TAUPE, background: 'none', border: 'none', cursor: 'pointer', borderBottom: activeTab === tab.key ? `2px solid ${RED}` : '2px solid transparent', transition: 'all 0.2s', position: 'relative' }}>
            {tab.label}
            {tab.count > 0 && (
              <span style={{ marginLeft: 6, background: activeTab === tab.key ? RED : SAND, color: activeTab === tab.key ? WHITE : TAUPE, borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 20px 80px' }} className="md:px-0">

        {/* Modal confirmer remise */}
        <Modal
          isOpen={!!deliverModal}
          onClose={() => { setDeliverModal(null); setDeliverCode(''); setDeliverError('') }}
          title={t.delivery.confirm_title}
          closeDisabled={delivering}
        >
          <p style={{ fontSize: 13, color: TAUPE, marginBottom: 12 }}>{t.delivery.enter_code}</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={deliverCode}
            onChange={e => setDeliverCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t.delivery.code_placeholder}
            style={{
              width: '100%', padding: '12px', textAlign: 'center',
              fontSize: 28, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 8,
              background: '#f5f3f0', border: '1px solid ' + BORDER, borderRadius: 12,
              outline: 'none', boxSizing: 'border-box' as const, marginBottom: 8,
            }}
          />
          {deliverError && <p style={{ fontSize: 12, color: RED, marginBottom: 8 }}>{deliverError}</p>}
          <Button fullWidth loading={delivering} disabled={delivering || deliverCode.length !== 6} onClick={handleDeliver}>
            {t.delivery.confirm_btn}
          </Button>
        </Modal>

        {/* Onglet : En attente */}
        {activeTab === 'pending' && (
          pendingBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 20, background: SAND, marginBottom: 16 }}>
                <Package size={32} color={TAUPE} strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.carrier.no_bookings}</p>
              <p style={{ fontSize: 13, color: TAUPE }}>{t.carrier.no_bookings_sub}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingBookings.map((booking: any) => (
                <div key={booking.id} style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
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
          )
        )}

        {/* Onglet : Traitées */}
        {activeTab === 'treated' && (
          treatedBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.carrier.no_treated_bookings}</p>
              <p style={{ fontSize: 13, color: TAUPE }}>{t.carrier.no_treated_bookings_sub}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {treatedBookings.map((booking: any) => {
                const pickupMeetingReached = !!booking.pickup_meeting_date && new Date() >= new Date(booking.pickup_meeting_date)
                const canPickup = ['accepted', 'paid'].includes(booking.status) && pickupMeetingReached
                const canDeliver = booking.status === 'in_transit'
                return (
                  <div key={booking.id}
                    onClick={() => router.push(`/packages/${booking.id}`)}
                    style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: canPickup || canDeliver ? 10 : 0 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>{booking.content_description || 'Colis'}</p>
                        <p style={{ fontSize: 12, color: TAUPE, marginTop: 2 }}>{booking.weight_kg} kg · {booking.amount?.toFixed(2)}€</p>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>
                    {canPickup && (
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/packages/${booking.id}`) }}
                        style={{
                          padding: '8px 14px', background: '#EFF6FF',
                          border: '1px solid #93C5FD', borderRadius: 10, fontSize: 13,
                          fontWeight: 600, color: '#2563EB', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <Plane size={14} /> {t.carrier.pickup_btn}
                      </button>
                    )}
                    {canDeliver && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeliverModal({ bookingId: booking.id }); setDeliverError('') }}
                        style={{
                          padding: '8px 14px', background: '#ECFDF5',
                          border: '1px solid #6EE7B7', borderRadius: 10, fontSize: 13,
                          fontWeight: 600, color: '#059669', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <Check size={14} /> {t.delivery.confirm_btn}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {activeTab === 'trips' && (
          loadingTrips ? (
            <div style={{ height: 80, background: WHITE, borderRadius: 14, border: '1px solid ' + BORDER }} />
          ) : myTrips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 20, background: SAND, marginBottom: 16 }}>
                <Plane size={32} color={TAUPE} strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.carrier.no_trips}</p>
              <p style={{ fontSize: 13, color: TAUPE }}>{t.carrier.no_trips_sub}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myTrips.map((trip: any) => (
                <div key={trip.id} onClick={() => router.push(`/trips/${trip.id}`)}
                  style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(220,0,41,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 18, fontWeight: 800, color: CHARCOAL }}>{trip.origin_airport_code}</span>
                      <Plane size={14} color={TAUPE} />
                      <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 18, fontWeight: 800, color: CHARCOAL }}>{trip.destination_airport_code}</span>
                    </div>
                    <p style={{ fontSize: 12, color: TAUPE }}>{trip.departure_date} · {t.trip.kg_available.replace('{n}', String(trip.remaining_kg))} · {trip.price_per_kg}€/kg</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusBadge status={trip.status} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setTripToDelete({ id: trip.id, label: `${trip.origin_airport_code} → ${trip.destination_airport_code}` })
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    >
                      <Trash2 size={15} color={RED} />
                    </button>
                    <ChevronRight size={16} color={TAUPE} />
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <Modal
        isOpen={!!tripToDelete}
        onClose={() => setTripToDelete(null)}
        title={t.carrier.trip_delete_confirm}
      >
        <p style={{ fontSize: 13, color: TAUPE, marginBottom: 20 }}>
          {tripToDelete?.label}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" disabled={deletingTrip} onClick={() => setTripToDelete(null)}>
            {t.profile_edit.cancel}
          </Button>
          <Button variant="danger" size="sm" loading={deletingTrip} onClick={async () => {
              if (!tripToDelete) return
              setDeletingTrip(true)
              try {
                await api.delete(`/trips/${tripToDelete.id}`)
                toast.success(t.carrier.trip_deleted)
                queryClient.invalidateQueries({ queryKey: ['my-trips'] })
                setTripToDelete(null)
              } catch (err: any) {
                const detail = err?.response?.data?.detail
                if (detail && detail.includes('active_bookings')) {
                  toast.error('Ce trajet a des réservations actives et ne peut pas être supprimé.')
                } else {
                  toast.error(t.errors.generic)
                }
              } finally {
                setDeletingTrip(false)
              }
            }}>
            {t.profile_edit.delete_confirm}
          </Button>
        </div>
      </Modal>
    </div>
  )
}