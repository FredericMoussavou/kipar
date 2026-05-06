'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plane, User, RefreshCw, MessageCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import ChatModal from '@/components/ui/kipar/ChatModal'
import Modal from '@/components/ui/kipar/Modal'
import QRCode from 'qrcode'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, RED, GREEN, AMBER } from '@/lib/theme'
import { CRITERIA_I18N_MAP } from '@/lib/review'
import { getTrustGradient } from '@/lib/trust'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid ' + SAND }}>
      <span style={{ fontSize: 13, color: TAUPE }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL }}>{value || '—'}</span>
    </div>
  )
}

function PersonCard({ firstName, lastName, email, kycStatus, trustScore, role, onPress, t }: {
  firstName?: string; lastName?: string; email?: string
  kycStatus?: string; trustScore?: number; role: string; onPress?: () => void; t: any
}) {
  const score = Math.round(trustScore || 50)
  const { gradient, color } = getTrustGradient(score)
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`

  return (
    <div onClick={onPress}
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: onPress ? 'pointer' : 'default' }}
      onMouseEnter={e => { if (onPress) (e.currentTarget as HTMLElement).style.opacity = '0.8' }}
      onMouseLeave={e => { if (onPress) (e.currentTarget as HTMLElement).style.opacity = '1' }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: CHARCOAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {initials ? (
          <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 16, fontWeight: 700, color: WHITE }}>{initials}</span>
        ) : (
          <User size={20} color={WHITE} />
        )}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>
          {firstName} {lastName}
          {onPress && <span style={{ fontSize: 11, color: RED, marginLeft: 6 }}>{t.package_detail.see_profile}</span>}
        </p>
        <p style={{ fontSize: 12, color: kycStatus === 'verified' ? '#059669' : TAUPE }}>
          {role} {kycStatus === 'verified' ? t.package_detail.kyc_verified : ''}
        </p>
        {email && <p style={{ fontSize: 11, color: TAUPE }}>{email}</p>}
      </div>
      {trustScore !== undefined && (
        <div style={{ width: 60 }}>
          <div style={{ height: 4, background: SAND, borderRadius: 99, overflow: 'hidden', marginBottom: 2 }}>
            <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: gradient, borderRadius: 99 }} />
          </div>
          <p style={{ fontSize: 10, fontWeight: 700, color, textAlign: 'right' }}>{score}</p>
        </div>
      )}
    </div>
  )
}

export default function BookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const queryClient = useQueryClient()
  const [deliveryData, setDeliveryData] = useState<{qr_token: string; code?: string; expires_at: string} | null>(null)
  const [generating, setGenerating] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null)
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({})
  const reviewCommentRef = useRef<HTMLTextAreaElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: async () => {
      const res = await api.get(`/bookings/${id}/full`)
      return res.data
    },
  })

  const isSender_ = user?.id === booking?.sender_id
  const isReceiver_ = user?.id === booking?.receiver_id

  const reviewTargetIdForQuery = booking ? (
    isSender_ ? booking.carrier_id :
    isReceiver_ ? booking.carrier_id :
    booking.sender_id
  ) : null

  const { data: canReviewData } = useQuery({
    queryKey: ['can-review', id, reviewTargetIdForQuery],
    enabled: !!booking && !!reviewTargetIdForQuery && ['delivered','cancelled_by_carrier','cancelled_by_sender'].includes(booking.status),
    queryFn: async () => (await api.get(`/reviews/booking/${id}/can-review?reviewed_id=${reviewTargetIdForQuery}`)).data,
  })

  const reviewMutation = useMutation({
    mutationFn: async () => api.post('/reviews', {
      booking_id: id,
      reviewed_id: reviewTargetId,
      criteria: criteriaScores,
      comment: reviewCommentRef.current?.value || null,
    }),
    onSuccess: () => {
      setReviewOpen(false)
      setCriteriaScores({})
      if (reviewCommentRef.current) reviewCommentRef.current.value = ''
      queryClient.invalidateQueries({ queryKey: ['can-review', id, reviewTargetIdForQuery] })
    },
  })

  useEffect(() => {
    if (!deliveryData?.qr_token || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, deliveryData.qr_token, {
      width: 180,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#f5f3f0' },
    }).catch(console.error)
  }, [deliveryData])

  const canSeeCode = !!(booking && user?.id === booking?.receiver_id && booking.status === 'in_transit')



  const generateCode = async () => {
    if (!booking) return
    setGenerating(true)
    try {
      const res = await api.post(`/delivery/${booking.id}/generate-code`)
      setDeliveryData(res.data)
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
    } catch {
      // erreur silencieuse
    } finally {
      setGenerating(false)
    }
  }

  if (isLoading) return (
    <div style={{ padding: 20, paddingTop: 80 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: 100, background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER, marginBottom: 12 }} />
      ))}
    </div>
  )

  if (!booking) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: TAUPE }}>{t.package_detail.not_found}</p>
    </div>
  )

  // Détermine le rôle de l'utilisateur connecté
  const isSender = isSender_
  const isReceiver = isReceiver_
  const isCarrier = !isSender && !isReceiver

  const getDaysUntilDeparture = () => {
    if (!booking?.departure_date) return 999
    const dep = new Date(booking.departure_date)
    const today = new Date()
    today.setHours(0,0,0,0)
    dep.setHours(0,0,0,0)
    return Math.floor((dep.getTime() - today.getTime()) / (1000*60*60*24))
  }

  const getRefundMsg = () => {
    if (!booking || booking.status === 'pending') return t.packages.refund_full
    const days = getDaysUntilDeparture()
    if (days <= 0) return t.packages.refund_none
    if (days < 3) return t.packages.refund_partial
    return t.packages.refund_full
  }

  const handleCancel = async () => {
    if (!booking) return
    if (!cancelReason.trim()) { toast.error(t.packages.cancel_reason_required); return }
    setCancelling(true)
    try {
      await api.patch(`/bookings/${booking.id}/cancel`, { reason: cancelReason.trim() })
      toast.success(t.packages.booking_cancelled)
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
      setCancelOpen(false)
      setCancelReason('')
    } catch { toast.error(t.errors.generic) }
    finally { setCancelling(false) }
  }


  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>

      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80"
        minHeight={180}
        gradient="vertical"
      >
        <div style={{ padding: '48px 20px 24px', position: 'relative' }}>
          <button onClick={() => router.back()}
            style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={16} color="#fff" />
          </button>
          {booking.origin_airport_code && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
              <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 28, fontWeight: 800, color: '#fff' }}>{booking.origin_airport_code}</p>
              <Plane size={20} color="rgba(255,255,255,0.6)" />
              <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 28, fontWeight: 800, color: '#fff' }}>{booking.destination_airport_code}</p>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <StatusBadge status={booking.status} />
          </div>
          {booking.departure_date && (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              {booking.flight_number && `${booking.flight_number} · `}{booking.departure_date}
            </p>
          )}
        </div>
      </HeroHeader>

      <div style={{ padding: '16px 16px 80px' }} className="md:max-w-2xl md:mx-auto">

        {/* Colis */}
        <Section title={t.package_detail.section_package}>
          <InfoRow label={t.package_detail.field_content} value={booking.content_description} />
          <InfoRow label={t.package_detail.field_weight} value={booking.weight_kg ? `${booking.weight_kg} kg` : null} />
          <InfoRow label={t.package_detail.field_declared_value} value={booking.declared_value ? `${booking.declared_value}€` : null} />
          <InfoRow label={t.package_detail.field_amount_paid} value={booking.amount ? `${booking.amount.toFixed(2)}€` : null} />
          <InfoRow label={t.package_detail.field_insurance} value={booking.insurance_subscribed ? t.package_detail.insurance_yes : t.package_detail.insurance_no} />
          {booking.ai_prohibited_flag && (
            <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10, padding: '8px 12px', marginTop: 8 }}>
              <p style={{ fontSize: 12, color: '#F59E0B', fontWeight: 500 }}>{t.package_detail.ai_flag_warning}</p>
            </div>
          )}
        </Section>

        {/* Transporteur — visible par expéditeur et récepteur */}
        {(isSender || isReceiver) && (booking.carrier_first_name || booking.carrier_last_name) && (
          <Section title={t.package_detail.section_carrier}>
            <PersonCard
              firstName={booking.carrier_first_name}
              lastName={booking.carrier_last_name}
              kycStatus={booking.carrier_kyc_status}
              trustScore={booking.carrier_trust_score}
              role={t.package_detail.role_carrier}
              onPress={() => router.push(`/profile/${booking.carrier_id}`)}
              t={t}
            />
          </Section>
        )}

        {/* Expéditeur — visible par transporteur et récepteur */}
        {(isCarrier || isReceiver) && booking.sender_first_name && (
          <Section title={t.package_detail.section_sender}>
            <PersonCard
              firstName={booking.sender_first_name}
              lastName={booking.sender_last_name}
              email={booking.sender_email}
              role={t.package_detail.role_sender}
              onPress={() => router.push(`/profile/${booking.sender_id}`)}
              t={t}
            />
          </Section>
        )}

        {/* Récepteur — visible par transporteur et expéditeur */}
        {(isCarrier || isSender) && booking.receiver_email && (
          <Section title={t.package_detail.section_receiver}>
            <PersonCard
              firstName={booking.receiver_first_name}
              lastName={booking.receiver_last_name}
              email={booking.receiver_email}
              role={t.package_detail.role_receiver}
              onPress={() => router.push(`/profile/${booking.receiver_id}`)}
              t={t}
            />
          </Section>
        )}

        {/* Section code de remise — récepteur uniquement */}
        {isReceiver && (canSeeCode || booking.status === 'delivered') && (
          <Section title={t.delivery.section_code}>
            {deliveryData ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: TAUPE, marginBottom: 8 }}>{t.delivery.code_label}</p>
                {deliveryData.code && (
                  <div style={{ background: SAND, borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'inline-block' }}>
                    <p style={{ fontSize: 36, fontWeight: 900, color: CHARCOAL, fontFamily: 'monospace', letterSpacing: 8, margin: 0 }}>
                      {deliveryData.code}
                    </p>
                  </div>
                )}
                <p style={{ fontSize: 12, color: TAUPE, marginBottom: 8 }}>{t.delivery.qr_label}</p>
                <canvas ref={canvasRef} style={{ border: '1px solid ' + BORDER, borderRadius: 8, display: 'block', margin: '0 auto 8px' }} />
                {deliveryData.expires_at && (
                  <p style={{ fontSize: 11, color: TAUPE }}>
                    {t.delivery.expires} {new Date(deliveryData.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : booking.status === 'in_transit' ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ fontSize: 13, color: TAUPE, marginBottom: 16 }}>{t.delivery.generate_hint}</p>
                <button
                  onClick={generateCode}
                  disabled={generating}
                  style={{ background: CHARCOAL, color: WHITE, border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.6 : 1 }}
                >
                  {generating ? t.delivery.generating : t.delivery.generate_btn}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 14, fontWeight: 700, color: GREEN, textAlign: 'center', padding: '8px 0' }}>
                {t.delivery.status_delivered}
              </p>
            )}
          </Section>
        )}

        {/* Confirmation livraison — expéditeur */}
        {isSender && booking.status === 'delivered' && (
          <Section title={t.delivery.section_code}>
            <p style={{ fontSize: 14, fontWeight: 700, color: GREEN, textAlign: 'center', padding: '8px 0' }}>
              {t.delivery.status_delivered}
            </p>
          </Section>
        )}
        {canReviewData?.can_review && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <button
              onClick={() => { setReviewTargetId(reviewTargetIdForQuery); setReviewOpen(true) }}
              style={{ padding: '12px 28px', background: 'rgb(245,158,11)', color: WHITE, border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ⭐ {t.profile_edit.review_btn}
            </button>
          </div>
        )}

        {booking.cancellation_reason && ['cancelled_by_sender','cancelled_by_carrier'].includes(booking.status) && (
          <Section title={t.packages.cancel_reason_label}>
            <p style={{ fontSize: 13, color: CHARCOAL, lineHeight: 1.5 }}>{booking.cancellation_reason}</p>
          </Section>
        )}

        {(() => {
          const photos = booking.ai_scan_result?.photos?.length > 0
            ? booking.ai_scan_result.photos
            : booking.photo_urls?.length > 0
              ? booking.photo_urls
              : null
          if (!photos) return null
          return (
            <Section title={t.package_detail.section_photos}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {photos.map((url: string, i: number) => (
                  <img key={i} src={url} alt={`Photo ${i + 1}`}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10 }} />
                ))}
              </div>
            </Section>
          )
        })()}
      </div>

      {/* Bulle messagerie flottante */}
      {['accepted','paid','in_transit','delivered','refused','cancelled'].includes(booking.status) && (
        <button
          onClick={() => setChatOpen(true)}
          style={{
            position: 'fixed', bottom: 88, right: 20, zIndex: 100,
            width: 52, height: 52, borderRadius: '50%',
            background: CHARCOAL, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
          aria-label={t.chat.title}
        >
          <MessageCircle size={22} color={WHITE} />
        </button>
      )}

      {chatOpen && (
        <ChatModal
          bookingId={String(id)}
          bookingStatus={booking.status}
          onClose={() => setChatOpen(false)}
        />
      )}

      {(isSender && ['pending','accepted','paid'].includes(booking.status) || isCarrier && booking.status === 'accepted') && (
        <button onClick={() => setCancelOpen(true)}
          style={{ position: 'fixed', bottom: 148, right: 20, zIndex: 100,
            width: 52, height: 52, borderRadius: '50%', background: RED,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 4px 16px rgba(220,0,41,0.3)' }}
          aria-label={t.packages.cancel_booking}>
          <XCircle size={22} color={WHITE} />
        </button>
      )}

      <Modal isOpen={cancelOpen} onClose={() => { setCancelOpen(false); setCancelReason('') }} title={t.packages.confirm_cancel}>
        <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#92400E', fontWeight: 600, marginBottom: 4 }}>{t.payment.cancel_policy_title}</p>
          <p style={{ fontSize: 12, color: '#92400E' }}>{isCarrier ? t.packages.refund_full : getRefundMsg()}</p>
        </div>
        <textarea
          value={cancelReason}
          onChange={e => setCancelReason(e.target.value)}
          placeholder={t.packages.cancel_reason_placeholder}
          rows={3}
          style={{ width: '100%', borderRadius: 10, border: '1px solid ' + BORDER, padding: '10px 12px', fontSize: 13, color: CHARCOAL, resize: 'none', marginBottom: 12, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => { setCancelOpen(false); setCancelReason('') }} disabled={cancelling}
            style={{ padding: '10px 20px', background: 'transparent', color: TAUPE, border: '1px solid ' + BORDER, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {t.profile_edit.cancel}
          </button>
          <button onClick={handleCancel} disabled={cancelling}
            style={{ padding: '10px 20px', background: RED, color: WHITE, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: cancelling ? 'not-allowed' : 'pointer', opacity: cancelling ? 0.5 : 1, minWidth: 100 }}>
            {cancelling ? '...' : t.packages.cancel_booking}
          </button>
        </div>
      </Modal>

      {/* Modal notation */}
      <Modal isOpen={reviewOpen} onClose={() => setReviewOpen(false)} title={t.profile_edit.section_review}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {canReviewData?.criteria?.map((criterion: string) => (
            <div key={criterion}>
              <p style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL, marginBottom: 8 }}>
                {(t.profile_edit as any)[CRITERIA_I18N_MAP[criterion]] || criterion}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1,2,3,4,5].map(star => (
                  <button key={star} type="button" onClick={() => setCriteriaScores(prev => ({ ...prev, [criterion]: star }))}
                    style={{ fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', opacity: (criteriaScores[criterion] ?? 0) >= star ? 1 : 0.3 }}>
                    ⭐
                  </button>
                ))}
              </div>
            </div>
          ))}
          <textarea
            ref={reviewCommentRef}
            placeholder={t.profile_edit.review_comment_placeholder}
            rows={3}
            style={{ width: '100%', borderRadius: 10, border: '1px solid ' + BORDER, padding: '10px 12px', fontSize: 13, color: CHARCOAL, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setReviewOpen(false)}
              style={{ padding: '10px 20px', background: 'transparent', color: TAUPE, border: '1px solid ' + BORDER, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {t.profile_edit.cancel}
            </button>
            <button
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending || !canReviewData?.criteria?.every((c: string) => criteriaScores[c])}
              style={{ padding: '10px 20px', background: RED, color: WHITE, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: reviewMutation.isPending ? 0.5 : 1, minWidth: 120 }}>
              {reviewMutation.isPending ? '...' : t.profile_edit.review_submit_btn}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}