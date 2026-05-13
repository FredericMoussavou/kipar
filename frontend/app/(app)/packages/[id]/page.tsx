'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plane, User, MessageCircle, Clock, Check, X, Camera, AlertTriangle, ShieldAlert, XCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import ChatModal from '@/components/ui/kipar/ChatModal'
import Modal from '@/components/ui/kipar/Modal'
import DatePicker from '@/components/ui/kipar/DatePicker'
import TimePicker from '@/components/ui/kipar/TimePicker'
import Button from '@/components/ui/kipar/Button'
import Input from '@/components/ui/kipar/Input'
import Textarea from '@/components/ui/kipar/Textarea'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import HeroHeader from '@/components/layout/HeroHeader'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import api from '@/lib/api'
import { CHARCOAL, TAUPE, SAND, BORDER, WHITE, RED, GREEN, AMBER } from '@/lib/theme'
import { getTrustGradient } from '@/lib/trust'
import QRCode from 'qrcode'

/* ─── COMPOSANTS INTERNES ─────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid ' + SAND }}>
      <span style={{ fontSize: 13, color: TAUPE }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL }}>{value ?? '—'}</span>
    </div>
  )
}

function PersonCard({ firstName, lastName, role, kycStatus, trustScore, onPress }: any) {
  const score = Math.round(trustScore || 50)
  const { gradient, color } = getTrustGradient(score)
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`
  return (
    <div onClick={onPress} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, cursor: onPress ? 'pointer' : 'default' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: CHARCOAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: WHITE, fontWeight: 700, fontSize: 14 }}>{initials || <User size={18} color={WHITE} />}</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>{firstName} {lastName}</p>
        <p style={{ fontSize: 11, color: kycStatus === 'verified' ? GREEN : TAUPE }}>{role} {kycStatus === 'verified' ? '✓ Vérifié' : ''}</p>
      </div>
      {trustScore !== undefined && (
        <div style={{ width: 50, textAlign: 'right' }}>
          <p style={{ fontSize: 10, fontWeight: 800, color }}>{score}%</p>
          <div style={{ height: 3, background: SAND, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${score}%`, height: '100%', background: gradient }} />
          </div>
        </div>
      )}
    </div>
  )
}

function MeetingBadge({ label, date, color }: { label: string; date: string; color: string }) {
  const fmt = new Date(date).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: color + '15', border: `1px solid ${color}30`, marginBottom: 10 }}>
      <Clock size={14} color={color} />
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL }}>{fmt}</p>
      </div>
    </div>
  )
}

/* ─── PAGE PRINCIPALE ─────────────────────────────────────────────────────── */

export default function BookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pickupCodeInputRef = useRef<HTMLInputElement>(null)
  const deliveryCodeInputRef = useRef<HTMLInputElement>(null)

  // UI state
  const [chatOpen, setChatOpen] = useState(false)
  const [pickupModalOpen, setPickupModalOpen] = useState(false)
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [pickupFailedOpen, setPickupFailedOpen] = useState(false)
  const [deliveryFailedOpen, setDeliveryFailedOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [incidentReason, setIncidentReason] = useState('')
  const [contestReason, setContestReason] = useState('')
  const [contestOpen, setContestOpen] = useState(false)
  const [deliveryContestReason, setDeliveryContestReason] = useState('')
  const [deliveryContestOpen, setDeliveryContestOpen] = useState(false)

  // Date/heure picker state
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('09:00')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('09:00')

  // Code state
  const [pickupCodeData, setPickupCodeData] = useState<{ code: string; qr_token: string } | null>(null)
  const [deliveryCodeData, setDeliveryCodeData] = useState<{ code: string; qr_token: string } | null>(null)

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: async () => (await api.get(`/bookings/${id}/full`)).data,
  })

  const { data: flightTracking } = useQuery({
    queryKey: ['flight-tracking', booking?.trip_id],
    queryFn: async () => {
      if (!booking?.trip_id || !booking?.flight_number) return null
      try {
        const res = await api.get(`/tracking/${booking.trip_id}/flight`)
        return res.data
      } catch { return null }
    },
    enabled: !!booking?.trip_id && !!booking?.flight_number && ['in_transit', 'delivery_reported'].includes(booking?.status || ''),
    refetchInterval: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!deliveryCodeData?.qr_token || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, deliveryCodeData.qr_token, {
      width: 160, margin: 2,
      color: { dark: '#3D3D3D', light: '#F0EDE8' },
    }).catch(console.error)
  }, [deliveryCodeData])



  // Rôles
  const isSender = user?.id === booking?.sender_id
  const isReceiver = user?.id === booking?.receiver_id
  const isCarrier = user?.id === booking?.carrier_id

  // ── Helpers pickup ──────────────────────────────────────────────────────────
  const hasPendingPickup = !!booking?.proposed_pickup_date
  const hasPickupMeeting = !!booking?.pickup_meeting_date
  const isPickupProposedByMe = user?.id === booking?.proposed_pickup_by

  // ── Helpers delivery ────────────────────────────────────────────────────────
  const hasPendingDelivery = !!booking?.proposed_delivery_date
  const hasDeliveryMeeting = !!booking?.delivery_meeting_date
  const isDeliveryProposedByMe = user?.id === booking?.proposed_delivery_by
  const rescheduleCount = booking?.delivery_reschedule_count || 0
  const canReschedule = rescheduleCount < 3
  const canFailPickup = hasPickupMeeting && new Date() >= new Date(booking?.pickup_meeting_date || '')

  // Boutons livraison déverrouillés seulement à l'heure du RDV
  const deliveryUnlocked = hasDeliveryMeeting && !hasPendingDelivery &&
    new Date() >= new Date(booking?.delivery_meeting_date)
  const deliveryMeetingReached = hasDeliveryMeeting && new Date() >= new Date(booking?.delivery_meeting_date || '')

  // ── Mutations ───────────────────────────────────────────────────────────────

  const buildMeetingISO = (date: string, time: string) => {
    if (!date) return null
    const [h, m] = time.split(':').map(Number)
    const d = new Date(date)
    d.setHours(h, m, 0, 0)
    return d.toISOString()
  }

  const isMeetingInPast = (date: string, time: string) => {
    if (!date) return false
    const iso = buildMeetingISO(date, time)
    if (!iso) return false
    return new Date(iso) <= new Date()
  }

  const isPickupTooLate = (date: string, time: string) => {
    if (!date || !booking?.departure_date || !booking?.departure_time) return false
    const iso = buildMeetingISO(date, time)
    if (!iso) return false
    const [dh, dm] = booking.departure_time.split(':').map(Number)
    const dep = new Date(booking.departure_date)
    dep.setHours(dh, dm, 0, 0)
    return new Date(iso) >= new Date(dep.getTime() - 3 * 60 * 60 * 1000)
  }

  const isDeliveryBeforeArrival = (date: string, time: string) => {
    if (!date || !booking?.arrival_date) return false
    const iso = buildMeetingISO(date, time)
    if (!iso) return false
    if (booking?.arrival_time) {
      const [ah, am] = booking.arrival_time.split(':').map(Number)
      const arr = new Date(booking.arrival_date)
      arr.setHours(ah, am, 0, 0)
      return new Date(iso) <= arr
    }
    return new Date(iso).toDateString() === new Date(booking.arrival_date).toDateString() ||
           new Date(iso) < new Date(booking.arrival_date)
  }

  const pickupDateError = pickupDate ? (
    isMeetingInPast(pickupDate, pickupTime) ? (t.packages.rdv_error_past || 'RDV dans le passé') :
    isPickupTooLate(pickupDate, pickupTime) ? (t.packages.rdv_error_too_late || 'Moins de 3h avant le départ') : ''
  ) : ''

  const deliveryDateError = deliveryDate ? (
    isMeetingInPast(deliveryDate, deliveryTime) ? (t.packages.rdv_error_past || 'RDV dans le passé') :
    isDeliveryBeforeArrival(deliveryDate, deliveryTime) ? (t.packages.rdv_error_before_arrival || 'Avant l\'arrivée du vol') : ''
  ) : ''

  const proposePickupMutation = useMutation({
    mutationFn: async () => {
      const iso = buildMeetingISO(pickupDate, pickupTime)
      if (!iso) throw new Error('Date requise')
      return api.post(`/delivery/${id}/propose-pickup-meeting`, { meeting_date: iso })
    },
    onSuccess: () => {
      toast.success(t.packages.pickup_meeting_proposed)
      setPickupModalOpen(false)
      setPickupDate('')
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const confirmPickupMutation = useMutation({
    mutationFn: () => api.post(`/delivery/${id}/confirm-pickup-meeting`),
    onSuccess: () => {
      toast.success(t.packages.pickup_meeting_confirmed)
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const generatePickupCodeMutation = useMutation({
    mutationFn: () => api.post(`/delivery/${id}/generate-pickup-code`),
    onSuccess: (res) => setPickupCodeData(res.data),
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const validatePickupMutation = useMutation({
    mutationFn: (code: string) => api.post(`/delivery/${id}/validate-pickup-code`, { code }),
    onSuccess: () => {
      toast.success(t.packages.pickup_validated)
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    },
    onError: () => toast.error(t.packages.pickup_code_invalid),
  })

  const proposeDeliveryMutation = useMutation({
    mutationFn: async () => {
      const iso = buildMeetingISO(deliveryDate, deliveryTime)
      if (!iso) throw new Error('Date requise')
      return api.post(`/delivery/${id}/propose-delivery-meeting`, { meeting_date: iso })
    },
    onSuccess: () => {
      toast.success(t.packages.delivery_meeting_proposed)
      setDeliveryModalOpen(false)
      setDeliveryDate('')
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const confirmDeliveryMutation = useMutation({
    mutationFn: () => api.post(`/delivery/${id}/confirm-delivery-meeting`),
    onSuccess: () => {
      toast.success(t.packages.delivery_meeting_confirmed)
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      const iso = buildMeetingISO(deliveryDate, deliveryTime)
      if (!iso) throw new Error('Date requise')
      return api.post(`/delivery/${id}/reschedule-delivery`, { meeting_date: iso })
    },
    onSuccess: () => {
      toast.success(t.packages.delivery_meeting_proposed)
      setDeliveryModalOpen(false)
      setDeliveryDate('')
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const generateDeliveryCodeMutation = useMutation({
    mutationFn: () => api.post(`/delivery/${id}/generate-code`),
    onSuccess: (res) => setDeliveryCodeData(res.data),
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const validateDeliveryMutation = useMutation({
    mutationFn: (code: string) => api.post(`/delivery/${id}/validate`, { code }),
    onSuccess: () => {
      toast.success(t.packages.delivery_confirmed)
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
    },
    onError: () => toast.error(t.packages.delivery_code_invalid),
  })

  const alternativeProofMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', 'kipar_package_photos')
      const res = await fetch(
        'https://api.cloudinary.com/v1_1/' + process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME + '/image/upload',
        { method: 'POST', body: formData }
      )
      const data = await res.json()
      if (!data.secure_url) throw new Error('Upload failed')
      return api.post(`/delivery/${id}/delivery-alternative-proof`, { proof_url: data.secure_url })
    },
    onSuccess: () => {
      toast.success(t.packages.delivery_alternative_proof_sent)
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/bookings/${id}/cancel`, { reason: cancelReason.trim() }),
    onSuccess: () => {
      toast.success(t.packages.booking_cancelled)
      setCancelOpen(false)
      setCancelReason('')
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

    const respondDeliveryFailedMutation = useMutation({
    mutationFn: (response: string) => api.patch(`/delivery/${id}/failed/respond`, { response }),
    onSuccess: () => {
      toast.success(t.packages.delivery_failed_contested)
      setDeliveryContestOpen(false)
      setDeliveryContestReason('')
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const acceptDeliveryFailedMutation = useMutation({
    mutationFn: () => api.patch(`/delivery/${id}/failed/respond`, { response: 'accept' }),
    onSuccess: () => {
      toast.success(t.packages.delivery_failed_accepted)
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const respondPickupFailedMutation = useMutation({
    mutationFn: (reason: string) => api.patch(`/bookings/${id}/pickup-failed/respond`, { reason }),
    onSuccess: () => {
      toast.success(t.packages.pickup_failed_contested)
      setContestOpen(false)
      setContestReason('')
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const acceptPickupFailedMutation = useMutation({
    mutationFn: () => api.patch(`/bookings/${id}/pickup-failed/respond`, { reason: 'accept' }),
    onSuccess: () => {
      toast.success(t.packages.pickup_failed_accepted)
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const pickupFailedMutation = useMutation({
    mutationFn: () => api.patch(`/bookings/${id}/pickup-failed`, { reason: incidentReason.trim() }),
    onSuccess: () => {
      toast.success(t.packages.pickup_failed_reported || 'Incident signalé')
      setPickupFailedOpen(false)
      setIncidentReason('')
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

  const deliveryFailedMutation = useMutation({
    mutationFn: () => api.post(`/delivery/${id}/failed`, { comment: incidentReason.trim() }),
    onSuccess: () => {
      toast.success(t.packages.delivery_failed_reported || 'Incident signalé')
      setDeliveryFailedOpen(false)
      setIncidentReason('')
      queryClient.invalidateQueries({ queryKey: ['booking', id] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || t.errors.generic),
  })

const handleCancel = () => {
    if (!cancelReason.trim()) { toast.error(t.packages.cancel_reason_required); return }
    cancelMutation.mutate()
  }
  
  if (isLoading || !booking) return (
    <div style={{ padding: 40, textAlign: 'center', color: TAUPE }}>Chargement...</div>
  )
  /* ─── RENDER ──────────────────────────────────────────────────────────────── */

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh', paddingBottom: 100 }}>
      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80"
        minHeight={180}
        gradient="vertical"
      >
        <div style={{ padding: '48px 20px 24px', position: 'relative' }}>
          <button onClick={() => router.back()}
            style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={16} color={WHITE} />
          </button>
          {booking.origin_airport_code && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
              <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 28, fontWeight: 800, color: WHITE }}>{booking.origin_airport_code}</p>
              <Plane size={20} color="rgba(255,255,255,0.6)" />
              <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 28, fontWeight: 800, color: WHITE }}>{booking.destination_airport_code}</p>
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

        {/* ── INFOS COLIS ──────────────────────────────────────────────────── */}
        <Section title={t.package_detail.section_package}>
          <InfoRow label={t.package_detail.field_content} value={booking.content_description} />
          <InfoRow label={t.package_detail.field_weight} value={booking.weight_kg ? `${booking.weight_kg} kg` : null} />
          <InfoRow label={t.package_detail.field_declared_value} value={booking.declared_value ? `${booking.declared_value}€` : null} />
          <InfoRow label={t.package_detail.field_amount_paid} value={booking.amount ? `${booking.amount.toFixed(2)}€` : null} />
          <InfoRow label={t.package_detail.field_insurance} value={booking.insurance_subscribed ? t.package_detail.insurance_yes : t.package_detail.insurance_no} />
        </Section>

        {/* ── BLOC PICKUP FAILED ──────────────────────────────────────────────── */}
        {booking.status === 'pickup_failed' && (isSender || isCarrier) && (
          <Section title={t.packages.pickup_failed_title}>
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: RED, marginBottom: 4 }}>
                {booking.pickup_failed_by === (isCarrier ? 'carrier' : 'sender')
                  ? t.packages.pickup_failed_declared_by_you
                  : t.packages.pickup_failed_declared_by_other}
              </p>
              {booking.incident_response_deadline && (
                <p style={{ fontSize: 11, color: TAUPE }}>
                  {t.packages.pickup_failed_deadline} : {new Date(booking.incident_response_deadline).toLocaleString('fr-FR')}
                </p>
              )}
            </div>
            {/* Partie mise en cause — peut accepter ou contester */}
            {booking.pickup_failed_by !== (isCarrier ? 'carrier' : 'sender') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Button fullWidth variant="danger" loading={acceptPickupFailedMutation.isPending} onClick={() => acceptPickupFailedMutation.mutate()}>
                  {t.packages.pickup_failed_accept_btn}
                </Button>
                <Button fullWidth variant="outline" onClick={() => setContestOpen(true)}>
                  {t.packages.pickup_failed_contest_btn}
                </Button>
              </div>
            )}
          </Section>
        )}

        {/* ── BLOC DELIVERY FAILED ─────────────────────────────────────────────── */}
        {booking.status === 'delivery_failed' && (isSender || isCarrier || isReceiver) && (
          <Section title={t.packages.delivery_failed_response_title}>
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: RED, marginBottom: 4 }}>
                {booking.delivery_failed_by === (isCarrier ? 'carrier' : isReceiver ? 'receiver' : 'sender')
                  ? t.packages.delivery_failed_declared_by_you
                  : t.packages.delivery_failed_declared_by_other}
              </p>
              {booking.incident_response_deadline && (
                <p style={{ fontSize: 11, color: TAUPE }}>
                  {t.packages.delivery_failed_deadline} : {new Date(booking.incident_response_deadline).toLocaleString('fr-FR')}
                </p>
              )}
            </div>
            {booking.delivery_failed_by !== (isCarrier ? 'carrier' : isReceiver ? 'receiver' : 'sender') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Button fullWidth variant="danger" loading={acceptDeliveryFailedMutation.isPending} onClick={() => acceptDeliveryFailedMutation.mutate()}>
                  {t.packages.delivery_failed_accept_btn}
                </Button>
                <Button fullWidth variant="outline" onClick={() => setDeliveryContestOpen(true)}>
                  {t.packages.delivery_failed_contest_btn}
                </Button>
              </div>
            )}
          </Section>
        )}

        {/* ── BLOC DISPUTED ────────────────────────────────────────────────────── */}
        {booking.status === 'disputed' && (
          <Section title={t.packages.status_disputed_title}>
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <ShieldAlert size={18} color={AMBER} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 13, color: CHARCOAL, lineHeight: 1.6, margin: 0 }}>{t.packages.status_disputed_desc}</p>
            </div>
          </Section>
        )}

        {/* ── BLOC CANCELLED ────────────────────────────────────────────────────── */}
        {booking.status === 'cancelled' && (
          <Section title={t.packages.status_cancelled_title}>
            <div style={{ background: SAND, borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 13, color: TAUPE, margin: 0 }}>{t.packages.status_cancelled_desc}</p>
              {booking.cancellation_reason && (
                <p style={{ fontSize: 12, color: TAUPE, marginTop: 6, fontStyle: 'italic' }}>{booking.cancellation_reason}</p>
              )}
            </div>
          </Section>
        )}

        {/* ── BLOC DELIVERED ────────────────────────────────────────────────────── */}
        {booking.status === 'delivered' && (
          <Section title={t.packages.status_delivered_title}>
            <div style={{ background: '#ECFDF5', border: '1px solid #86EFAC', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <CheckCircle size={18} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 13, color: CHARCOAL, lineHeight: 1.6, margin: 0 }}>{t.packages.status_delivered_desc}</p>
            </div>
            {isSender && (
              <Button fullWidth variant="outline" onClick={() => router.push(`/profile/${booking.carrier_id}`)}>
                {t.packages.status_delivered_review_btn}
              </Button>
            )}
          </Section>
        )}

        {/* ── BLOC COLLECTE (accepted) ──────────────────────────────────────── */}
        {booking.status === 'accepted' && (isSender || isCarrier) && (
          <>
            {/* RDV Collecte */}
            <Section title={t.package_detail.section_package + ' — ' + t.packages.pickup_meeting_propose_btn}>
              {hasPickupMeeting && (
                <MeetingBadge
                  label={t.packages.pickup_meeting_label}
                  date={booking?.pickup_meeting_date}
                  color={GREEN}
                />
              )}
              {hasPendingPickup && (
                <MeetingBadge
                  label={t.packages.pickup_meeting_pending_label}
                  date={booking?.proposed_pickup_date}
                  color={AMBER}
                />
              )}
              {hasPendingPickup && !isPickupProposedByMe && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button
                    onClick={() => confirmPickupMutation.mutate()}
                    disabled={confirmPickupMutation.isPending}
                    style={{ flex: 1, padding: '10px', background: GREEN, color: WHITE, borderRadius: 10, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Check size={14} /> {t.packages.accept}
                  </button>
                  <button
                    onClick={() => setPickupModalOpen(true)}
                    style={{ flex: 1, padding: '10px', background: SAND, color: CHARCOAL, borderRadius: 10, border: '1px solid ' + BORDER, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <X size={14} /> {t.packages.refuse}
                  </button>
                </div>
              )}
              {hasPendingPickup && isPickupProposedByMe && (
                <p style={{ fontSize: 12, color: TAUPE, marginBottom: 10 }}>{t.packages.pickup_meeting_waiting}</p>
              )}
              {!hasPendingPickup && (
                <Button fullWidth onClick={() => setPickupModalOpen(true)} style={{ background: CHARCOAL }}>
                  {hasPickupMeeting ? (t.packages.pickup_meeting_reschedule_btn || 'Modifier le RDV') : t.packages.pickup_meeting_propose_btn}
                </Button>
              )}
            </Section>

            {/* Sécurité remise */}
            <Section title={t.packages.section_pickup_security}>
              {!hasPickupMeeting ? (
                <p style={{ fontSize: 12, color: TAUPE, textAlign: 'center' }}>{t.packages.pickup_rdv_required}</p>
              ) : isCarrier ? (
                !pickupCodeData ? (
                  <Button fullWidth loading={generatePickupCodeMutation.isPending} disabled={generatePickupCodeMutation.isPending || !canFailPickup} onClick={() => generatePickupCodeMutation.mutate()} style={{ background: GREEN }}>
                    {!canFailPickup ? "Disponible à l'heure du RDV" : (t.packages.pickup_code_generate_btn || "Générer le code pickup")}
                  </Button>
                ) : (
                  <div style={{ textAlign: 'center', padding: 16, background: SAND, borderRadius: 12, border: '1px solid ' + BORDER }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t.packages.pickup_code_label}</p>
                    <p style={{ fontSize: 40, fontWeight: 900, color: CHARCOAL, fontFamily: 'monospace', letterSpacing: 8 }}>{pickupCodeData.code}</p>
                  </div>
                )
              ) : isSender ? (
                <div>
                  <p style={{ fontSize: 12, color: TAUPE, marginBottom: 8, textAlign: 'center' }}>{t.packages.pickup_code_input_placeholder}</p>
                  <input
                    ref={pickupCodeInputRef}
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    onChange={(e) => {
                      if (e.target.value.length === 6) validatePickupMutation.mutate(e.target.value)
                    }}
                    style={{ width: '100%', textAlign: 'center', fontSize: 28, fontWeight: 900, padding: '10px 12px', border: '1px solid ' + BORDER, borderRadius: 12, fontFamily: 'monospace', letterSpacing: 6, color: CHARCOAL, boxSizing: 'border-box' }}
                  />
                </div>
              ) : null}
              <Button fullWidth variant="ghost" disabled={!canFailPickup} onClick={() => setPickupFailedOpen(true)} style={{ marginTop: 16, color: RED, border: '1px solid ' + RED + '40' }}>
                {t.packages.pickup_failed_btn || 'Échec collecte'}
              </Button>
            </Section>
          </>
        )}        {/* INFO TRANSIT SENDER */}
        {(booking.status === 'in_transit' || booking.status === 'delivery_reported') && isSender && (
          <Section title={t.packages.section_transit}>
            <div style={{ textAlign: 'center', padding: 16 }}>
              <p style={{ fontSize: 14, color: CHARCOAL, fontWeight: 600, marginBottom: 8 }}>{t.packages.in_transit_sender_title || 'Colis en cours de livraison'}</p>
              <p style={{ fontSize: 13, color: TAUPE }}>{t.packages.in_transit_sender_desc || 'Le transporteur est en route et gère la remise avec le destinataire.'}</p>
            </div>
          </Section>
        )}


        {/* ── BLOC SUIVI VOL ───────────────────────────────────────────────────── */}
        {['in_transit', 'delivery_reported'].includes(booking.status) && booking.flight_number && (
          <Section title={t.packages.flight_tracking_title}>
            {flightTracking ? (() => {
              const statusColors: Record<string, string> = {
                landed: GREEN, active: '#2563EB', delayed: AMBER,
                cancelled: RED, scheduled: TAUPE, unknown: TAUPE,
              }
              const statusLabels: Record<string, string> = {
                landed: t.packages.flight_status_landed,
                active: t.packages.flight_status_active,
                delayed: t.packages.flight_status_delayed,
                cancelled: t.packages.flight_status_cancelled,
                scheduled: t.packages.flight_status_scheduled,
                unknown: t.packages.flight_status_unknown,
              }
              const color = statusColors[flightTracking.status] || TAUPE
              const label = statusLabels[flightTracking.status] || flightTracking.status
              const fmt = (d: string | null) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Plane size={18} color={color} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: CHARCOAL, margin: 0 }}>{booking.flight_number}</p>
                      <p style={{ fontSize: 12, color, fontWeight: 600, margin: 0 }}>{label}</p>
                    </div>
                  </div>
                  {flightTracking.arrival_estimated && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TAUPE, marginBottom: 4 }}>
                      <span>{t.packages.flight_arrival_estimated}</span>
                      <span style={{ fontWeight: 600, color: CHARCOAL }}>{fmt(flightTracking.arrival_estimated)}</span>
                    </div>
                  )}
                  {flightTracking.arrival_actual && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TAUPE, marginBottom: 4 }}>
                      <span>{t.packages.flight_arrival_actual}</span>
                      <span style={{ fontWeight: 600, color: GREEN }}>{fmt(flightTracking.arrival_actual)}</span>
                    </div>
                  )}
                  {flightTracking.last_checked_at && (
                    <p style={{ fontSize: 10, color: TAUPE, marginTop: 8, textAlign: 'right' }}>
                      {t.packages.flight_last_updated} : {fmt(flightTracking.last_checked_at)}
                    </p>
                  )}
                </div>
              )
            })() : (
              <p style={{ fontSize: 12, color: TAUPE }}>{t.packages.flight_no_tracking}</p>
            )}
          </Section>
        )}

        {/* ── BLOC LIVRAISON (in_transit / delivery_reported) ───────────────── */}
        {(booking.status === 'in_transit' || booking.status === 'delivery_reported') && (isCarrier || isReceiver) && (
          <>
            {/* RDV Livraison */}
            <Section title={t.packages.section_delivery_rdv}>
              {hasDeliveryMeeting && (
                <MeetingBadge
                  label={t.packages.delivery_meeting_label}
                  date={booking?.delivery_meeting_date}
                  color={GREEN}
                />
              )}
              {hasPendingDelivery && (
                <MeetingBadge
                  label={t.packages.delivery_meeting_pending_label}
                  date={booking?.proposed_delivery_date}
                  color={AMBER}
                />
              )}
              {hasPendingDelivery && !isDeliveryProposedByMe && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <Button onClick={() => confirmDeliveryMutation.mutate()} loading={confirmDeliveryMutation.isPending} style={{ flex: 1, background: GREEN }}>
                    <Check size={14} /> {t.packages.accept}
                  </Button>
                  <Button variant="outline" onClick={() => setDeliveryModalOpen(true)} style={{ flex: 1 }}>
                    <X size={14} /> {t.packages.refuse}
                  </Button>
                </div>
              )}
              {hasPendingDelivery && isDeliveryProposedByMe && (
                <p style={{ fontSize: 12, color: TAUPE, marginBottom: 10 }}>{t.packages.delivery_meeting_waiting}</p>
              )}
              {!hasPendingDelivery && canReschedule && (
                <Button fullWidth onClick={() => setDeliveryModalOpen(true)} style={{ background: CHARCOAL, marginTop: 4 }}>
                  {hasDeliveryMeeting ? t.packages.delivery_meeting_reschedule_btn : t.packages.delivery_meeting_propose_btn}
                </Button>
              )}
              {!canReschedule && (
                <p style={{ fontSize: 12, color: RED, textAlign: 'center', marginTop: 8 }}>{t.packages.delivery_reschedule_max}</p>
              )}
              {rescheduleCount > 0 && (
                <p style={{ fontSize: 11, color: TAUPE, textAlign: 'right', marginTop: 4 }}>{t.packages.delivery_reschedule_count} {rescheduleCount}/3</p>
              )}
            </Section>

            {/* Remise destinataire */}
            <Section title={t.packages.section_handover}>
              {!hasDeliveryMeeting ? (
                <p style={{ fontSize: 12, color: TAUPE, textAlign: 'center' }}>{t.packages.delivery_rdv_required}</p>
              ) : isReceiver ? (
                !deliveryCodeData ? (
                  <Button fullWidth loading={generateDeliveryCodeMutation.isPending} disabled={generateDeliveryCodeMutation.isPending || !deliveryUnlocked} onClick={() => generateDeliveryCodeMutation.mutate()} style={{ background: GREEN }}>
                    {!deliveryUnlocked ? "Disponible \xc3\xa0 l'heure du RDV" : (t.packages.delivery_code_generate_btn || 'G\xc3\xa9n\xc3\xa9rer le code')}
                  </Button>
                ) : (
                  <div style={{ textAlign: 'center', padding: 16, background: SAND, borderRadius: 12, border: '1px solid ' + BORDER }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t.packages.delivery_code_label}</p>
                    <p style={{ fontSize: 40, fontWeight: 900, color: CHARCOAL, fontFamily: 'monospace', letterSpacing: 8, marginBottom: 12 }}>{deliveryCodeData.code}</p>
                    <canvas ref={canvasRef} style={{ border: '1px solid ' + BORDER, borderRadius: 8, display: 'block', margin: '0 auto' }} />
                  </div>
                )
              ) : isCarrier ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 12, color: TAUPE, marginBottom: 8, textAlign: 'center' }}>{t.packages.delivery_code_input_placeholder}</p>
                    <input
                      ref={deliveryCodeInputRef}
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      disabled={!deliveryUnlocked}
                      onChange={(e) => {
                        if (e.target.value.length === 6) validateDeliveryMutation.mutate(e.target.value)
                      }}
                      style={{ width: '100%', textAlign: 'center', fontSize: 28, fontWeight: 900, padding: '10px 12px', border: '1px solid ' + BORDER, borderRadius: 12, fontFamily: 'monospace', letterSpacing: 6, color: CHARCOAL, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ borderTop: '1px dashed ' + BORDER, paddingTop: 12 }}>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) alternativeProofMutation.mutate(file)
                      }}
                      style={{ display: 'none' }}
                    />
                    <Button fullWidth variant="ghost" loading={alternativeProofMutation.isPending} disabled={alternativeProofMutation.isPending || !deliveryUnlocked} onClick={() => fileInputRef.current?.click()} style={{ color: RED, border: '1px solid ' + RED + '40' }}>
                      <Camera size={16} /> {t.packages.delivery_alternative_proof_btn}
                    </Button>
                  </div>
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Button variant="ghost" disabled={!deliveryMeetingReached} onClick={() => setDeliveryFailedOpen(true)} style={{ flex: 1, color: RED, border: '1px solid ' + RED + '40', opacity: deliveryMeetingReached ? 1 : 0.5 }}>
                  {t.packages.delivery_failed_btn || 'Échec livraison'}
                </Button>
                <Button variant="ghost" disabled={!deliveryMeetingReached} onClick={() => setSupportOpen(true)} style={{ flex: 1, color: AMBER, border: '1px solid ' + AMBER + '40', opacity: deliveryMeetingReached ? 1 : 0.5 }}>
                  {t.packages.support_btn || 'Signaler problème'}
                </Button>
              </div>
            </Section>
          </>
        )}

        {/* ── INTERVENANTS ──────────────────────────────────────────────────── */}
        <Section title={t.packages.section_participants}>
          {!isCarrier && booking.carrier_first_name && (
            <PersonCard firstName={booking.carrier_first_name} lastName={booking.carrier_last_name} role={t.package_detail.role_carrier} trustScore={booking.carrier_trust_score} kycStatus={booking.carrier_kyc_status} onPress={() => router.push(`/profile/${booking?.carrier_id}`)} />
          )}
          {!isSender && booking.sender_first_name && (
            <PersonCard firstName={booking.sender_first_name} lastName={booking.sender_last_name} role={t.package_detail.role_sender} onPress={() => router.push(`/profile/${booking?.sender_id}`)} />
          )}
          {!isReceiver && booking.receiver_first_name && (
            <PersonCard firstName={booking.receiver_first_name} lastName={booking.receiver_last_name} role={t.package_detail.role_receiver} onPress={() => router.push(`/profile/${booking?.receiver_id}`)} />
          )}
        </Section>

        {/* ── ANNULATION ────────────────────────────────────────────────────── */}
        {(isSender || isCarrier) && ['pending', 'accepted', 'paid'].includes(booking.status) && !hasPickupMeeting && (
          <Button fullWidth variant="ghost" onClick={() => setCancelOpen(true)} style={{ marginTop: 8, color: RED, border: '1px solid ' + RED + '40' }}>
            {t.packages.cancel_booking}
          </Button>
        )}
      </div>

      {/* ── FAB CHAT ────────────────────────────────────────────────────────── */}
      {['accepted', 'paid', 'in_transit', 'delivered', 'delivery_reported'].includes(booking.status) && (
        <button
          onClick={() => setChatOpen(true)}
          style={{ position: 'fixed', bottom: 88, right: 20, zIndex: 100, width: 52, height: 52, borderRadius: '50%', background: CHARCOAL, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
          aria-label={t.chat.title}>
          <MessageCircle size={22} color={WHITE} />
        </button>
      )}

      {chatOpen && <ChatModal bookingId={String(id)} bookingStatus={booking.status} onClose={() => setChatOpen(false)} />}

      {/* ── MODAL RDV COLLECTE ──────────────────────────────────────────────── */}
      <Modal isOpen={pickupModalOpen} onClose={() => setPickupModalOpen(false)} title={t.packages.pickup_meeting_propose_btn}>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: TAUPE, marginBottom: 12 }}>{t.packages.pickup_date_constraint}</p>
          <DatePicker
            value={pickupDate}
            onChange={setPickupDate}
            min={new Date().toISOString().split('T')[0]}
          />
          <div style={{ marginTop: 10 }}>
            <TimePicker
              value={pickupTime}
              onChange={setPickupTime}
            />
          </div>
        </div>
        {pickupDateError && <p style={{ fontSize: 12, color: RED, marginBottom: 8 }}>{pickupDateError}</p>}
        <Button fullWidth loading={proposePickupMutation.isPending} disabled={proposePickupMutation.isPending || !pickupDate || !!pickupDateError} onClick={() => proposePickupMutation.mutate()} style={{ background: CHARCOAL }}>
          Envoyer la proposition
        </Button>
      </Modal>

      {/* ── MODAL RDV LIVRAISON ─────────────────────────────────────────────── */}
      <Modal isOpen={deliveryModalOpen} onClose={() => setDeliveryModalOpen(false)} title={hasDeliveryMeeting ? t.packages.delivery_meeting_reschedule_btn : t.packages.delivery_meeting_propose_btn}>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: TAUPE, marginBottom: 12 }}>{t.packages.delivery_date_constraint}</p>
          <DatePicker
            value={deliveryDate}
            onChange={setDeliveryDate}
            min={new Date().toISOString().split('T')[0]}
          />
          <div style={{ marginTop: 10 }}>
            <TimePicker
              value={deliveryTime}
              onChange={setDeliveryTime}
            />
          </div>
        </div>
        {deliveryDateError && <p style={{ fontSize: 12, color: RED, marginBottom: 8 }}>{deliveryDateError}</p>}
        <Button fullWidth loading={proposeDeliveryMutation.isPending || rescheduleMutation.isPending} disabled={proposeDeliveryMutation.isPending || rescheduleMutation.isPending || !deliveryDate || !!deliveryDateError} onClick={() => hasDeliveryMeeting ? rescheduleMutation.mutate() : proposeDeliveryMutation.mutate()} style={{ background: CHARCOAL }}>
          Envoyer la proposition
        </Button>
      </Modal>

      {/* ── MODAL ANNULATION ────────────────────────────────────────────────── */}
      <Modal isOpen={deliveryContestOpen} onClose={() => { setDeliveryContestOpen(false); setDeliveryContestReason('') }} title={t.packages.delivery_failed_contest_btn}>
        <Textarea value={deliveryContestReason} onChange={e => setDeliveryContestReason(e.target.value)} placeholder={t.packages.delivery_failed_contest_placeholder} rows={3} style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" onClick={() => { setDeliveryContestOpen(false); setDeliveryContestReason('') }}>
            {t.profile_edit.cancel}
          </Button>
          <Button size="sm" loading={respondDeliveryFailedMutation.isPending} disabled={respondDeliveryFailedMutation.isPending || !deliveryContestReason.trim()} onClick={() => respondDeliveryFailedMutation.mutate(deliveryContestReason)}>
            {t.packages.delivery_failed_contest_btn}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={contestOpen} onClose={() => { setContestOpen(false); setContestReason('') }} title={t.packages.pickup_failed_contest_btn}>
        <Textarea value={contestReason} onChange={e => setContestReason(e.target.value)} placeholder={t.packages.pickup_failed_contest_placeholder} rows={3} style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" onClick={() => { setContestOpen(false); setContestReason('') }}>
            {t.profile_edit.cancel}
          </Button>
          <Button size="sm" loading={respondPickupFailedMutation.isPending} disabled={respondPickupFailedMutation.isPending || !contestReason.trim()} onClick={() => respondPickupFailedMutation.mutate(contestReason)}>
            {t.packages.pickup_failed_contest_btn}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={pickupFailedOpen} onClose={() => { setPickupFailedOpen(false); setIncidentReason('') }} title={t.packages.pickup_failed_btn || 'Échec collecte'}>
        <Textarea value={incidentReason} onChange={e => setIncidentReason(e.target.value)} placeholder={t.packages.incident_reason_placeholder || 'Expliquez la situation...'} rows={3} style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button size="sm" loading={pickupFailedMutation.isPending} disabled={pickupFailedMutation.isPending || !incidentReason.trim()} onClick={() => pickupFailedMutation.mutate()}>
            {t.packages.pickup_failed_btn || 'Échec collecte'}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={deliveryFailedOpen} onClose={() => { setDeliveryFailedOpen(false); setIncidentReason('') }} title={t.packages.delivery_failed_btn || 'Échec livraison'}>
        <Textarea value={incidentReason} onChange={e => setIncidentReason(e.target.value)} placeholder={t.packages.incident_reason_placeholder || 'Expliquez la situation...'} rows={3} style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button size="sm" loading={deliveryFailedMutation.isPending} disabled={deliveryFailedMutation.isPending || !incidentReason.trim()} onClick={() => deliveryFailedMutation.mutate()}>
            {t.packages.delivery_failed_btn || 'Échec livraison'}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={cancelOpen} onClose={() => { setCancelOpen(false); setCancelReason('') }} title={t.packages.confirm_cancel}>
        <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder={t.packages.cancel_reason_placeholder} rows={3} style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" onClick={() => { setCancelOpen(false); setCancelReason('') }}>
            {t.profile_edit.cancel}
          </Button>
          <Button variant="danger" size="sm" loading={cancelMutation.isPending} onClick={handleCancel}>
            {t.packages.cancel_booking}
          </Button>
        </div>
      </Modal>
    </div>
  )
}