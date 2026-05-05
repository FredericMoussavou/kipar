'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Package, ChevronRight, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/kipar/Modal'
import { useTranslation } from '@/hooks/useTranslation'
import { useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, RED } from '@/lib/theme'

export default function PackagesPage() {
  const { t } = useTranslation()
  const { isAuthenticated, user: authUser } = useAuthStore()
  const router = useRouter()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { user } = useAuthStore()

  const queryClient = useQueryClient()
  const [toCancel, setToCancel] = useState<{id: string; status: string; amount: number} | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const handleCancel = async () => {
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

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['my-bookings'],
    enabled: isAuthenticated(),
    queryFn: async () => {
      const res = await api.get('/bookings/detail')
      return res.data
    },
  })

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>

      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1599658880436-c61792e70672?w=1200&q=80"
        minHeight={160}
      >
        <div style={{ padding: '48px 24px 28px' }} className="md:p-8">
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}
            className="md:text-3xl">
            {t.packages.title}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
            {bookings.length > 1 ? t.packages.booking_count_many.replace('{n}', bookings.length) : t.packages.booking_count_one.replace('{n}', bookings.length)}
          </p>
          <button
            onClick={() => router.push('/requests/new')}
            style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={14} />
            {t.requests.create_alert_btn}
          </button>
        </div>
      </HeroHeader>

      <div style={{ padding: '20px 20px 80px' }} className="md:px-0">
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 90, background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER }} />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: SAND, marginBottom: 16 }}>
              <Package size={36} color={TAUPE} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>
              {t.packages.empty}
            </p>
            <p style={{ fontSize: 13, color: TAUPE }}>
              {t.packages.empty_sub}
            </p>
            <button
              onClick={() => router.push('/requests/new')}
              style={{ marginTop: 16, padding: '12px 24px', background: RED, color: WHITE, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              {t.requests.post_btn}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Filtre statuts — expéditeur uniquement */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              {['all','pending','accepted','paid','in_transit','delivered','refused','cancelled'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, border: '1px solid ' + (statusFilter === s ? CHARCOAL : BORDER), background: statusFilter === s ? CHARCOAL : WHITE, color: statusFilter === s ? WHITE : TAUPE, cursor: 'pointer' }}>
                  {s === 'all' ? t.packages.filter_all : (t.statuses[s as keyof typeof t.statuses] || s)}
                </button>
              ))}
            </div>
            {bookings.filter((b: any) => statusFilter === 'all' || b.status === statusFilter).map((booking: any) => (
              <div
                key={booking.id}
                onClick={() => router.push(`/packages/${booking.id}`)}
                style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(220,0,41,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
              >
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
                    <span>{booking.weight_kg} kg</span>
                    <span>{booking.amount?.toFixed(2)}€</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <StatusBadge status={booking.status} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {(['pending','accepted','paid'].includes(booking.status)) && (
                      <button onClick={e => { e.stopPropagation(); setToCancel({ id: booking.id, status: booking.status, amount: booking.amount }) }}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(220,0,41,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <X size={13} color={RED} />
                      </button>
                    )}
                    <ChevronRight size={16} color={TAUPE} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={!!toCancel} onClose={() => { setToCancel(null); setCancelReason('') }} title={t.packages.confirm_cancel}>
        {toCancel && (() => {
          const refundMsg = toCancel.status === 'pending'
            ? t.packages.refund_full
            : (() => {
                if (!toCancel) return t.packages.refund_full
                return t.packages.refund_full
              })()
          return (
            <div>
              <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: '#92400E', fontWeight: 600, marginBottom: 4 }}>{t.payment.cancel_policy_title}</p>
                <p style={{ fontSize: 12, color: '#92400E' }}>{refundMsg}</p>
              </div>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder={t.packages.cancel_reason_placeholder}
                rows={3}
                style={{ width: '100%', borderRadius: 10, border: '1px solid ' + BORDER, padding: '10px 12px', fontSize: 13, color: CHARCOAL, resize: 'none', marginBottom: 12, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => { setToCancel(null); setCancelReason('') }} disabled={cancelling}
                  style={{ padding: '10px 20px', background: 'transparent', color: TAUPE, border: '1px solid ' + BORDER, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {t.profile_edit.cancel}
                </button>
                <button onClick={handleCancel} disabled={cancelling}
                  style={{ padding: '10px 20px', background: RED, color: WHITE, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: cancelling ? 'not-allowed' : 'pointer', opacity: cancelling ? 0.5 : 1, minWidth: 100 }}>
                  {cancelling ? '...' : t.packages.cancel_booking}
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}