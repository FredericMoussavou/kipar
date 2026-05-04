'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plane, User, RefreshCw } from 'lucide-react'
import QRCode from 'qrcode'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, RED, GREEN } from '@/lib/theme'
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

        {booking.ai_scan_result?.photos?.length > 0 && (
          <Section title={t.package_detail.section_photos}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {booking.ai_scan_result.photos.map((url: string, i: number) => (
                <img key={i} src={url} alt={`Photo ${i + 1}`}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10 }} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}