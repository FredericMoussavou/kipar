'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Package, MapPin, User, Scale, Euro, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { CHARCOAL, TAUPE, BORDER, WHITE, RED, GREEN, SAND, BG } from '@/lib/theme'

type InvitationData = {
  token: string
  contact: string
  sender_full_name: string
  origin: string
  destination: string
  departure_date: string
  content_description: string
  weight_kg: number
  declared_value: number
  amount: number
  insurance_subscribed: boolean
  expires_at: string
}

type PageState = 'loading' | 'ready' | 'confirmed' | 'refused' | 'expired' | 'already' | 'not_found' | 'error'

export default function ReceiverPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const { t } = useTranslation()

  const [state, setState] = useState<PageState>('loading')
  const [data, setData] = useState<InvitationData | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [accountCreated, setAccountCreated] = useState(false)
  const [receiverEmail, setReceiverEmail] = useState<string>('')

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

  useEffect(() => {
    if (!token) return
    fetch(`${apiBase}/receiver/${token}`)
      .then(async (res) => {
        if (res.status === 404) { setState('not_found'); return }
        if (res.status === 410) { setState('expired'); return }
        if (res.status === 409) { setState('already'); return }
        if (!res.ok) { setState('error'); return }
        const json = await res.json()
        setData(json)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [token, apiBase])

  const handleConfirm = async () => {
    if (!token) return
    setActionLoading(true)
    try {
      const res = await fetch(`${apiBase}/receiver/${token}/confirm`, { method: 'POST' })
      if (!res.ok) { setState('error'); return }
      const json = await res.json()
      setTempPassword(json.temp_password ?? null)
      setAccountCreated(json.account_created ?? false)
      setReceiverEmail(json.receiver_email ?? '')
      setState('confirmed')
    } catch {
      setState('error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRefuse = async () => {
    if (!token) return
    setActionLoading(true)
    try {
      const res = await fetch(`${apiBase}/receiver/${token}/refuse`, { method: 'POST' })
      if (!res.ok) { setState('error'); return }
      setState('refused')
    } catch {
      setState('error')
    } finally {
      setActionLoading(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: BG,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  }

  const cardStyle: React.CSSProperties = {
    background: WHITE,
    border: `1px solid ${BORDER}`,
    borderRadius: 24,
    padding: '32px 24px',
    maxWidth: 480,
    width: '100%',
  }

  const logoStyle: React.CSSProperties = {
    fontFamily: 'var(--font-syne, Syne)',
    fontSize: 24,
    fontWeight: 900,
    color: CHARCOAL,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: '-1px',
  }

  // ── États terminaux ──────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={logoStyle}>KI<span style={{ color: RED }}>PAR</span></p>
          <p style={{ textAlign: 'center', color: TAUPE, fontSize: 14 }}>{t.receiver.loading}</p>
        </div>
      </div>
    )
  }

  if (state === 'expired') return <StatusCard emoji="⏰" title={t.receiver.expired_title} desc={t.receiver.expired_desc} />
  if (state === 'already') return <StatusCard emoji="✅" title={t.receiver.already_title} desc={t.receiver.already_desc} />
  if (state === 'not_found') return <StatusCard emoji="🔍" title={t.receiver.not_found_title} desc={t.receiver.not_found_desc} />
  if (state === 'error') return <StatusCard emoji="⚠️" title="Erreur" desc={t.receiver.error_generic} />

  if (state === 'refused') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={logoStyle}>KI<span style={{ color: RED }}>PAR</span></p>
          <div style={{ textAlign: 'center' }}>
            <XCircle size={48} color={TAUPE} style={{ marginBottom: 16 }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: CHARCOAL, margin: '0 0 8px' }}>{t.receiver.refused_title}</h2>
            <p style={{ fontSize: 14, color: TAUPE, lineHeight: 1.6 }}>{t.receiver.refused_desc}</p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'confirmed') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={logoStyle}>KI<span style={{ color: RED }}>PAR</span></p>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <CheckCircle size={48} color={GREEN} style={{ marginBottom: 16 }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: CHARCOAL, margin: '0 0 8px' }}>{t.receiver.confirmed_title}</h2>
            <p style={{ fontSize: 14, color: TAUPE, lineHeight: 1.6 }}>
              {accountCreated ? t.receiver.confirmed_desc : t.receiver.confirmed_existing}
            </p>
          </div>
          {accountCreated && tempPassword && (
            <div style={{ background: SAND, borderRadius: 12, padding: '16px', marginBottom: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: TAUPE, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t.receiver.temp_password_label}
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: CHARCOAL, fontFamily: 'monospace', margin: '0 0 6px' }}>
                {tempPassword}
              </p>
              <p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>{t.receiver.temp_password_note}</p>
            </div>
          )}
          {accountCreated && (
            <button
              onClick={() => router.push(`/login?email=${encodeURIComponent(receiverEmail)}`)}
              style={{
                width: '100%', padding: '14px', background: RED, color: WHITE,
                border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.receiver.login_btn}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── État principal : ready ───────────────────────────────────────────────
  if (!data) return null
  const expiresDate = new Date(data.expires_at).toLocaleDateString()

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <p style={logoStyle}>KI<span style={{ color: RED }}>PAR</span></p>

        <h1 style={{ fontSize: 20, fontWeight: 800, color: CHARCOAL, margin: '0 0 4px', textAlign: 'center' }}>
          {t.receiver.title}
        </h1>
        <p style={{ fontSize: 13, color: TAUPE, textAlign: 'center', margin: '0 0 24px' }}>
          {t.receiver.from} <strong style={{ color: CHARCOAL }}>{data.sender_full_name}</strong>
        </p>

        {/* Détails colis */}
        <div style={{ background: SAND, borderRadius: 16, padding: '16px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DetailRow icon={<MapPin size={15} />} label={t.receiver.route} value={`${data.origin} → ${data.destination}`} />
          <DetailRow icon={<Package size={15} />} label={t.receiver.content} value={data.content_description} />
          <DetailRow icon={<Scale size={15} />} label={t.receiver.weight} value={`${data.weight_kg} kg`} />
          <DetailRow icon={<Euro size={15} />} label={t.receiver.value} value={`${data.declared_value} €`} />
          <DetailRow icon={<Clock size={15} />} label={t.receiver.expires} value={expiresDate} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleConfirm}
            disabled={actionLoading}
            style={{
              width: '100%', padding: '14px', background: RED, color: WHITE,
              border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              opacity: actionLoading ? 0.7 : 1,
            }}
          >
            {actionLoading ? t.receiver.confirming : t.receiver.confirm_btn}
          </button>
          <button
            onClick={handleRefuse}
            disabled={actionLoading}
            style={{
              width: '100%', padding: '12px', background: 'transparent', color: TAUPE,
              border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 13, fontWeight: 600,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            {actionLoading ? t.receiver.refusing : t.receiver.refuse_btn}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Composants UI ────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: TAUPE, display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 11, color: TAUPE, minWidth: 90 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL }}>{value}</span>
    </div>
  )
}

function StatusCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f3f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 24, padding: '32px 24px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-syne, Syne)', fontSize: 24, fontWeight: 900, color: CHARCOAL, marginBottom: 24, letterSpacing: '-1px' }}>
          KI<span style={{ color: RED }}>PAR</span>
        </p>
        <p style={{ fontSize: 40, marginBottom: 16 }}>{emoji}</p>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: CHARCOAL, margin: '0 0 8px' }}>{title}</h2>
        <p style={{ fontSize: 14, color: TAUPE, lineHeight: 1.6 }}>{desc}</p>
      </div>
    </div>
  )
}
