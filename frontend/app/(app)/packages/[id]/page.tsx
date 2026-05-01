'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plane, User } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE } from '@/lib/theme'

function getTrustGradient(score: number) {
  if (score >= 75) return { gradient: 'linear-gradient(90deg,#F59E0B 0%,#4ADE80 60%,#16A34A 100%)', color: '#16A34A' }
  if (score >= 50) return { gradient: 'linear-gradient(90deg,#F59E0B 0%,#4ADE80 100%)', color: '#4ADE80' }
  if (score >= 30) return { gradient: 'linear-gradient(90deg,#DC0029 0%,#F59E0B 100%)', color: '#F59E0B' }
  return { gradient: 'linear-gradient(90deg,#DC0029 0%,#F97316 100%)', color: '#DC0029' }
}

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

export default function BookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { t } = useTranslation()

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: async () => {
      const res = await api.get(`/bookings/${id}/full`)
      return res.data
    },
  })

  if (isLoading) return (
    <div style={{ padding: 20, paddingTop: 80 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: 100, background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER, marginBottom: 12 }} />
      ))}
    </div>
  )

  if (!booking) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: TAUPE }}>Réservation introuvable</p>
    </div>
  )

  const score = Math.round(booking.carrier_trust_score || 50)
  const { gradient, color } = getTrustGradient(score)

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>

      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80"
        minHeight={180}
        gradient="vertical"
      >
        <div style={{ padding: '48px 20px 24px', position: 'relative' }}>
          <button
            onClick={() => router.back()}
            style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
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

        <Section title="Colis">
          <InfoRow label="Contenu" value={booking.content_description} />
          <InfoRow label="Poids" value={booking.weight_kg ? `${booking.weight_kg} kg` : null} />
          <InfoRow label="Valeur déclarée" value={booking.declared_value ? `${booking.declared_value}€` : null} />
          <InfoRow label="Montant payé" value={booking.amount ? `${booking.amount.toFixed(2)}€` : null} />
          <InfoRow label="Assurance" value={booking.insurance_subscribed ? 'Oui' : 'Non'} />
          {booking.ai_prohibited_flag && (
            <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10, padding: '8px 12px', marginTop: 8 }}>
              <p style={{ fontSize: 12, color: '#F59E0B', fontWeight: 500 }}>⚠️ Contenu signalé par KiparScan</p>
            </div>
          )}
          {booking.ai_scan_result && (
            <div style={{ background: SAND, borderRadius: 10, padding: '8px 12px', marginTop: 8 }}>
              <p style={{ fontSize: 11, color: CHARCOAL2 }}>
                KiparScan : {typeof booking.ai_scan_result === 'object'
                  ? JSON.stringify(booking.ai_scan_result)
                  : booking.ai_scan_result}
              </p>
            </div>
          )}
        </Section>

        {(booking.carrier_first_name || booking.carrier_last_name) && (
          <Section title="Transporteur">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: CHARCOAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 16, fontWeight: 700, color: WHITE }}>
                  {booking.carrier_first_name?.[0]}{booking.carrier_last_name?.[0]}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>
                  {booking.carrier_first_name} {booking.carrier_last_name}
                </p>
                <p style={{ fontSize: 12, color: booking.carrier_kyc_status === 'verified' ? '#059669' : TAUPE }}>
                  {booking.carrier_kyc_status === 'verified' ? '✓ KYC Vérifié' : 'KYC en attente'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: TAUPE, minWidth: 28 }}>Trust</span>
              <div style={{ flex: 1, height: 5, background: SAND, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: gradient, borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 24, textAlign: 'right' }}>{score}</span>
            </div>
          </Section>
        )}

        {booking.receiver_email && (
          <Section title="Récepteur">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: SAND, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={20} color={CHARCOAL2} />
              </div>
              <div>
                {(booking.receiver_first_name || booking.receiver_last_name) && (
                  <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>
                    {booking.receiver_first_name} {booking.receiver_last_name}
                  </p>
                )}
                <p style={{ fontSize: 13, color: TAUPE }}>{booking.receiver_email}</p>
              </div>
            </div>
          </Section>
        )}

        {booking.ai_scan_result?.photos?.length > 0 && (
          <Section title="Photos KiparScan">
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