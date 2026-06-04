'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Package, ChevronRight, Plus, X, Inbox, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/kipar/Modal'
import { Button } from '@/components/ui/kipar'
import Textarea from '@/components/ui/kipar/Textarea'
import { useTranslation } from '@/hooks/useTranslation'
import { useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { WeightDisplay } from '@/components/ui/kipar/WeightDisplay'
import { CurrencyDisplay } from '@/components/ui/kipar/CurrencyDisplay'
import { PricePerWeightDisplay } from '@/components/ui/kipar/PricePerWeightDisplay'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, RED } from '@/lib/theme'
import { useDrawerStore } from '@/stores/drawer.store'

type Tab = 'listings' | 'bookings'

export default function PackagesPage() {
  const { open: openDrawer } = useDrawerStore()
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuthStore()
  const rates = useExchangeRates()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('listings')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Modal annulation booking
  const [toCancel, setToCancel] = useState<{ id: string; status: string; amount: number } | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // Modal suppression annonce
  const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null)
  const [toDeleteBooking, setToDeleteBooking] = useState<{ id: string; label: string } | null>(null)
  const [deletingBooking, setDeletingBooking] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data: listings = [], isLoading: loadingListings } = useQuery({
    queryKey: ['my-requests'],
    enabled: !!user,
    queryFn: async () => (await api.get('/requests/mine')).data,
  })

  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['my-bookings'],
    enabled: isAuthenticated(),
    queryFn: async () => (await api.get('/bookings/detail')).data,
  })

  const handleCancelBooking = async () => {
    if (!toCancel) return
    if (!cancelReason.trim()) { toast.error(t.packages.cancel_reason_required); return }
    setCancelling(true)
    try {
      await api.patch(`/bookings/${toCancel.id}/cancel`, { reason: cancelReason.trim() })
      toast.success(t.packages.booking_cancelled)
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      setToCancel(null)
      setCancelReason('')
    } catch { toast.error(t.errors.generic) }
    finally { setCancelling(false) }
  }

  const TERMINAL_STATUSES = ['cancelled', 'cancelled_by_sender', 'cancelled_by_carrier', 'refused', 'refunded', 'delivered']
  const isOlderThanOneYear = (dateStr: string) => {
    const d = new Date(dateStr)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    return d < oneYearAgo
  }

  const handleDeleteBooking = async () => {
    if (!toDeleteBooking) return
    setDeletingBooking(true)
    try {
      await api.delete(`/bookings/${toDeleteBooking.id}`)
      toast.success('Réservation supprimée')
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      setToDeleteBooking(null)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (detail?.includes('retention')) {
        toast.error('Ce colis doit être conservé encore 1 an avant suppression.')
      } else {
        toast.error(t.errors.generic)
      }
    } finally {
      setDeletingBooking(false)
    }
  }

  const handleDeleteListing = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api.delete(`/requests/${toDelete.id}`)
      toast.success(t.requests.deleted)
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
      setToDelete(null)
    } catch { toast.error(t.errors.generic) }
    finally { setDeleting(false) }
  }

  const tabStyle = (active: boolean) => ({
    flex: 1,
    padding: '10px 0',
    background: active ? WHITE : 'transparent',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? CHARCOAL : TAUPE,
    cursor: 'pointer' as const,
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
    transition: 'all 0.2s',
  })

  const filterStatuses = tab === 'listings'
    ? ['all', 'open', 'matched', 'cancelled']
    : ['all', 'pending', 'accepted', 'paid', 'in_transit', 'delivered', 'cancelled']

  const filteredListings = (listings as any[]).filter((r: any) => statusFilter === 'all' || r.status === statusFilter)
  const filteredBookings = (bookings as any[]).filter((b: any) => statusFilter === 'all' || b.status === statusFilter)

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      <HeroHeader
        onMenuOpen={openDrawer}
        imageUrl="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80"
        minHeight={160}
      >
        <div style={{ padding: '48px 24px 28px', textAlign:'center' }} className="md:p-8">
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4}}
            className="md:text-3xl">
            {t.packages.title}
          </h1>
          <button
            onClick={() => router.push('/requests/new')}
            style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={14} />
            {t.requests.create_alert_btn}
          </button>
        </div>
      </HeroHeader>

      <div style={{ padding: '16px 20px 80px' }} className="md:px-0">

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 4, background: SAND, borderRadius: 12, padding: 4, marginBottom: 16 }}>
          <button style={tabStyle(tab === 'listings')} onClick={() => { setTab('listings'); setStatusFilter('all') }}>
            {t.packages.tab_listings}
          </button>
          <button style={tabStyle(tab === 'bookings')} onClick={() => { setTab('bookings'); setStatusFilter('all') }}>
            {t.packages.tab_bookings}
          </button>
        </div>

        {/* Filtres statuts */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {filterStatuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, border: '1px solid ' + (statusFilter === s ? CHARCOAL : BORDER), background: statusFilter === s ? CHARCOAL : WHITE, color: statusFilter === s ? WHITE : TAUPE, cursor: 'pointer' }}>
              {s === 'all' ? t.packages.filter_all : (t.statuses[s as keyof typeof t.statuses] || s)}
            </button>
          ))}
        </div>

        {/* Onglet Mes annonces */}
        {tab === 'listings' && (
          loadingListings ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => <div key={i} style={{ height: 90, background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER }} />)}
            </div>
          ) : filteredListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: SAND, marginBottom: 16 }}>
                <Inbox size={36} color={TAUPE} strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.requests.empty}</p>
              <p style={{ fontSize: 13, color: TAUPE, marginBottom: 20 }}>{t.requests.empty_sub}</p>
              <Button size="lg" onClick={() => router.push('/requests/new')}>
                {t.requests.create_alert_btn}
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredListings.map((req: any) => (
                <div key={req.id}
                  onClick={() => router.push(`/requests/${req.id}`)}
                  style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(220,0,41,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 15, fontWeight: 800, color: CHARCOAL }}>
                        {req.origin_airport_code} → {req.destination_airport_code}
                      </p>
                      <StatusBadge status={req.status} />
                    </div>
                    <p style={{ fontSize: 12, color: TAUPE }}>{req.content_description} · <WeightDisplay value={req.weight_kg} unit='kg' userUnit={user?.weight_unit as any} /> · <PricePerWeightDisplay price={req.budget_per_kg} currency='EUR' unit='kg' userCurrency={user?.currency} userUnit={user?.weight_unit as any} rates={rates ?? undefined} /></p>
                    <p style={{ fontSize: 11, color: TAUPE, marginTop: 2 }}>
                      {t.requests.deadline_label}: {req.deadline_date} · {t.requests.applications}: {req.applications_count}
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setToDelete({ id: req.id, label: `${req.origin_airport_code} → ${req.destination_airport_code}` }) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                    <Trash2 size={15} color={RED} />
                  </button>
                  <ChevronRight size={16} color={TAUPE} />
                </div>
              ))}
            </div>
          )
        )}

        {/* Onglet Mes réservations */}
        {tab === 'bookings' && (
          loadingBookings ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => <div key={i} style={{ height: 90, background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER }} />)}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: SAND, marginBottom: 16 }}>
                <Package size={36} color={TAUPE} strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.packages.empty}</p>
              <p style={{ fontSize: 13, color: TAUPE }}>{t.packages.empty_sub}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredBookings.map((booking: any) => (
                <div key={booking.id}
                  onClick={() => router.push(`/packages/${booking.id}`)}
                  style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(220,0,41,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: SAND, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={20} color={CHARCOAL2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {booking.content_description || t.packages.default_content}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: TAUPE }}>
                      {booking.origin_airport_code && (
                        <span style={{ fontFamily: 'var(--font-syne,Syne)', fontWeight: 700, color: CHARCOAL2 }}>
                          {booking.origin_airport_code} → {booking.destination_airport_code}
                        </span>
                      )}
                      <span><WeightDisplay value={booking.weight_kg} unit={(booking.weight_unit ?? 'kg') as any} userUnit={user?.weight_unit as any} /></span>
                      <span><CurrencyDisplay amount={booking.amount ?? 0} currency={booking.currency ?? 'EUR'} userCurrency={user?.currency} rates={rates ?? undefined} exact /></span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusBadge status={booking.status} />
                    {booking.is_urgent && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: '#FFF3CD', color: '#92400E', fontWeight: 700, border: '1px solid #FFE082', flexShrink: 0 }}>
                        ⚡ Urgent
                      </span>
                    )}
                    {['pending', 'accepted', 'paid'].includes(booking.status) && booking.sender_id === user?.id && (
                      <button onClick={e => { e.stopPropagation(); setToCancel({ id: booking.id, status: booking.status, amount: booking.amount }) }}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(220,0,41,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <X size={13} color={RED} />
                      </button>
                    )}
                    {TERMINAL_STATUSES.includes(booking.status) && isOlderThanOneYear(booking.created_at) && (
                      <button onClick={e => { e.stopPropagation(); setToDeleteBooking({ id: booking.id, label: booking.content_description || 'Colis' }) }}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(220,0,41,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <Trash2 size={13} color={RED} />
                      </button>
                    )}
                    <ChevronRight size={16} color={TAUPE} />
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal suppression annonce */}
      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title={t.requests.delete_confirm}>
        <p style={{ fontSize: 13, color: TAUPE, marginBottom: 20 }}>{toDelete?.label}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" disabled={deleting} onClick={() => setToDelete(null)}>
            {t.profile_edit.cancel}
          </Button>
          <Button variant="danger" size="sm" loading={deleting} onClick={handleDeleteListing}>
            {t.profile_edit.delete_confirm}
          </Button>
        </div>
      </Modal>

      {/* Modal annulation booking */}
      <Modal isOpen={!!toCancel} onClose={() => { setToCancel(null); setCancelReason('') }} title={t.packages.confirm_cancel}>
        {toCancel && (
          <div>
            <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#92400E', fontWeight: 600, marginBottom: 4 }}>{t.payment.cancel_policy_title}</p>
              <p style={{ fontSize: 12, color: '#92400E' }}>{t.packages.refund_full}</p>
            </div>
            <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder={t.packages.cancel_reason_placeholder} rows={3} style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" disabled={cancelling} onClick={() => { setToCancel(null); setCancelReason('') }}>
                {t.profile_edit.cancel}
              </Button>
              <Button variant="danger" size="sm" loading={cancelling} onClick={handleCancelBooking}>
                {t.packages.cancel_booking}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal suppression booking */}
      <Modal isOpen={!!toDeleteBooking} onClose={() => setToDeleteBooking(null)} title="Supprimer ce colis">
        <p style={{ fontSize: 13, color: TAUPE, marginBottom: 8 }}>{toDeleteBooking?.label}</p>
        <p style={{ fontSize: 12, color: TAUPE, marginBottom: 20 }}>Cette action est irréversible. L’historique de ce colis sera masqué.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" disabled={deletingBooking} onClick={() => setToDeleteBooking(null)}>
            {t.profile_edit.cancel}
          </Button>
          <Button variant="danger" size="sm" loading={deletingBooking} onClick={handleDeleteBooking}>
            {t.profile_edit.delete_confirm}
          </Button>
        </div>
      </Modal>

    </div>
  )
}
