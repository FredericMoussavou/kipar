'use client'

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Package, ChevronRight, Plus, X, Inbox, Trash2, SlidersHorizontal, Hourglass } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/kipar/Modal'
import { Button } from '@/components/ui/kipar'
import Textarea from '@/components/ui/kipar/Textarea'
import { useTranslation } from '@/hooks/useTranslation'
import { useState, useRef, useEffect } from 'react'
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

function PaymentCountdown({ deadline, t }: { deadline: string; t: any }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const ms = new Date(deadline).getTime() - now
  const expired = ms <= 0
  const urgent = !expired && ms < 5 * 60 * 1000
  const labelFor = () => {
    const total = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    if (h >= 1) return `${pad(h)} h ${pad(m)} min`
    return `${pad(m)} min ${pad(s)} s`
  }
  const fg = expired ? '#DC0029' : urgent ? '#DC0029' : '#2563EB'
  const bgc = expired ? 'rgba(220,0,41,0.08)' : urgent ? 'rgba(220,0,41,0.08)' : '#EFF6FF'
  const bd = expired ? '#F5B5C0' : urgent ? '#F5B5C0' : '#BFDBFE'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: bgc, color: fg, border: '1px solid ' + bd, flexShrink: 0, boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', width: expired ? 'auto' : 110 }}>
      <Hourglass size={11} color={fg} />
      {expired ? (t.packages.payment_expired ?? 'Delai depasse') : labelFor()}
    </span>
  )
}
export default function PackagesPage() {
  const { open: openDrawer } = useDrawerStore()
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuthStore()
  const rates = useExchangeRates()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('listings')
  type Filters = { status: string; dateFrom: string; dateTo: string; origin: string; destination: string; includeTerminal: boolean }
  const EMPTY_FILTERS: Filters = { status: 'all', dateFrom: '', dateTo: '', origin: '', destination: '', includeTerminal: false }
  const [listingsFilters, setListingsFilters] = useState<Filters>(EMPTY_FILTERS)
  const [bookingsFilters, setBookingsFilters] = useState<Filters>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const buildParams = (f: Filters, pageParam: number) => {
    const p: any = { limit: 10, offset: pageParam }
    if (f.status && f.status !== 'all') p.status = f.status
    if (f.dateFrom) p.date_from = f.dateFrom
    if (f.dateTo) p.date_to = f.dateTo
    if (f.origin) p.origin = f.origin
    if (f.destination) p.destination = f.destination
    if (f.includeTerminal) p.include_terminal = true
    return p
  }

  // Modal annulation booking
  const [toCancel, setToCancel] = useState<{ id: string; status: string; amount: number } | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // Modal suppression annonce
  const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null)
  const [toDeleteBooking, setToDeleteBooking] = useState<{ id: string; label: string } | null>(null)
  const [deletingBooking, setDeletingBooking] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const listingsQuery = useInfiniteQuery({
    queryKey: ['my-requests', listingsFilters],
    enabled: !!user,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => (await api.get('/requests/mine', { params: buildParams(listingsFilters, pageParam as number) })).data,
    getNextPageParam: (lastPage: any, pages: any[]) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      return loaded < lastPage.total ? loaded : undefined
    },
  })
  const listings = listingsQuery.data?.pages.flatMap((p: any) => p.items) ?? []
  const loadingListings = listingsQuery.isLoading

  const bookingsQuery = useInfiniteQuery({
    queryKey: ['my-bookings', bookingsFilters],
    enabled: isAuthenticated(),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => (await api.get('/bookings/detail', { params: buildParams(bookingsFilters, pageParam as number) })).data,
    getNextPageParam: (lastPage: any, pages: any[]) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      return loaded < lastPage.total ? loaded : undefined
    },
  })
  const bookings = bookingsQuery.data?.pages.flatMap((p: any) => p.items) ?? []
  const loadingBookings = bookingsQuery.isLoading

  const listingsSentinel = useRef<HTMLDivElement | null>(null)
  const bookingsSentinel = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = tab === 'listings' ? listingsSentinel.current : bookingsSentinel.current
    if (!el) return
    const q = tab === 'listings' ? listingsQuery : bookingsQuery
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) {
        q.fetchNextPage()
      }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [tab, listingsQuery, bookingsQuery])

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

  const TERMINAL_STATUSES = ['cancelled', 'cancelled_by_sender', 'cancelled_by_carrier', 'refused', 'refunded', 'delivered', 'expired']
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

  const filters = tab === 'listings' ? listingsFilters : bookingsFilters
  const setFilters = tab === 'listings' ? setListingsFilters : setBookingsFilters
  const patchFilter = (k: keyof Filters, v: string) => setFilters((prev) => ({ ...prev, [k]: v }))
  const filteredListings = listings as any[]
  const filteredBookings = bookings as any[]

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
          <button style={tabStyle(tab === 'listings')} onClick={() => { setTab('listings'); setShowFilters(false) }}>
            {t.packages.tab_listings}
          </button>
          <button style={tabStyle(tab === 'bookings')} onClick={() => { setTab('bookings'); setShowFilters(false) }}>
            {t.packages.tab_bookings}
          </button>
        </div>

        {/* Barre Filtrer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={() => setShowFilters(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, border: '1px solid ' + BORDER, background: showFilters ? SAND : WHITE, color: CHARCOAL, cursor: 'pointer' }}>
            <SlidersHorizontal size={14} />
            {t.packages.filter_btn ?? 'Filtrer'}
          </button>
          {(filters.status !== 'all' || filters.dateFrom || filters.dateTo || filters.origin || filters.destination) && (
            <button onClick={() => setFilters(EMPTY_FILTERS)}
              style={{ fontSize: 11, color: TAUPE, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              {t.packages.filter_reset ?? 'Reinitialiser'}
            </button>
          )}
        </div>
        {showFilters && (
          <div style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => setFilters(prev => ({ ...prev, includeTerminal: !prev.includeTerminal }))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px', borderRadius: 12, border: '1px solid ' + (filters.includeTerminal ? CHARCOAL : BORDER), background: filters.includeTerminal ? SAND : WHITE, color: CHARCOAL, fontSize: 12, fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box' }}>
              <span>{t.packages.show_terminated ?? 'Afficher les terminées'}</span>
              <span style={{ color: filters.includeTerminal ? CHARCOAL : TAUPE }}>{filters.includeTerminal ? '✓' : ''}</span>
            </button>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t.packages.filter_status ?? 'Statut'}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {filterStatuses.map(s => (
                  <button key={s} onClick={() => patchFilter('status', s)}
                    style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, border: '1px solid ' + (filters.status === s ? CHARCOAL : BORDER), background: filters.status === s ? CHARCOAL : WHITE, color: filters.status === s ? WHITE : TAUPE, cursor: 'pointer' }}>
                    {s === 'all' ? t.packages.filter_all : (t.statuses[s as keyof typeof t.statuses] || s)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t.packages.filter_origin ?? 'Origine'}</p>
                <input value={filters.origin} onChange={e => patchFilter('origin', e.target.value.toUpperCase().slice(0, 3))} placeholder="CDG" maxLength={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 12, border: '1px solid ' + BORDER, fontSize: 13, textTransform: 'uppercase', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t.packages.filter_destination ?? 'Destination'}</p>
                <input value={filters.destination} onChange={e => patchFilter('destination', e.target.value.toUpperCase().slice(0, 3))} placeholder="DSS" maxLength={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 12, border: '1px solid ' + BORDER, fontSize: 13, textTransform: 'uppercase', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t.packages.filter_date_from ?? 'Du'}</p>
                <input type="date" value={filters.dateFrom} onChange={e => patchFilter('dateFrom', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 12, border: '1px solid ' + BORDER, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t.packages.filter_date_to ?? 'Au'}</p>
                <input type="date" value={filters.dateTo} onChange={e => patchFilter('dateTo', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 12, border: '1px solid ' + BORDER, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>
        )}

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
                      <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 16, fontWeight: 800, color: CHARCOAL }}>
                        {req.origin_airport_code} → {req.destination_airport_code}
                      </p>
                      <StatusBadge status={req.status} />
                    </div>
                    <p style={{ fontSize: 12, color: TAUPE }}>{req.content_description} · <WeightDisplay value={req.weight_kg} unit='kg' userUnit={user?.weight_unit as any} /> · {req.package_mode === 'small' ? <span>{t.booking.small_package_forfait}</span> : <PricePerWeightDisplay price={req.budget_per_kg} currency='EUR' unit='kg' userCurrency={user?.currency} userUnit={user?.weight_unit as any} rates={rates ?? undefined} />}</p>
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
              <div ref={listingsSentinel} style={{ height: 1 }} />
              {listingsQuery.isFetchingNextPage && (
                <div style={{ textAlign: 'center', padding: 12, fontSize: 12, color: TAUPE }}>...</div>
              )}
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
                    {booking.status === 'pending' && booking.payment_deadline && booking.sender_id === user?.id && (
                      <PaymentCountdown deadline={booking.payment_deadline} t={t} />
                    )}
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
              <div ref={bookingsSentinel} style={{ height: 1 }} />
              {bookingsQuery.isFetchingNextPage && (
                <div style={{ textAlign: 'center', padding: 12, fontSize: 12, color: TAUPE }}>...</div>
              )}
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
