'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'
import { Button, Input, OtpInput } from '@/components/ui/kipar'
import api from '@/lib/api'
import { RED, CHARCOAL, TAUPE, WHITE, BORDER, BG, AMBER, GREEN } from '@/lib/theme'
import { useResponsive } from '@/hooks/useResponsive'

type Step = 'email' | 'code' | 'success' | 'blocked'

export default function ReactivatePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { paddingH, paddingV } = useResponsive()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [blockedMsg, setBlockedMsg] = useState('')

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email requis'); return }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reactivate', { email: email.trim().toLowerCase() })
      setStep('code')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || ''
      if (err?.response?.status === 403) {
        setBlockedMsg(detail)
        setStep('blocked')
      } else {
        // Reponse generique pour ne pas reveler si le compte existe
        setStep('code')
      }
    } finally { setLoading(false) }
  }

  const handleConfirm = async () => {
    if (code.length < 6) return
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reactivate/confirm', { email: email.trim().toLowerCase(), code })
      setStep('success')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || ''
      if (err?.response?.status === 403) {
        setBlockedMsg(detail)
        setStep('blocked')
      } else {
        setError(detail || t.errors.generic)
      }
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: paddingH }}>
      <div style={{ width: '100%', maxWidth: 400, background: WHITE, borderRadius: 20, padding: paddingV, boxShadow: '0 4px 32px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 24, fontWeight: 900, color: CHARCOAL, marginBottom: 32, letterSpacing: '-0.02em' }}>
          KIPAR<span style={{ color: RED }}>.</span>
        </h1>

        {/* —— SUCCES —— */}
        {step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle size={32} color={GREEN} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: CHARCOAL, marginBottom: 8 }}>{t.profile_edit.reactivate_success}</h2>
            <p style={{ fontSize: 14, color: TAUPE, marginBottom: 32, lineHeight: 1.6 }}>Redirection automatique...</p>
            <Button fullWidth onClick={() => router.push('/login')}>{t.auth.login_btn}</Button>
          </div>
        )}

        {/* —— BLOQUE —— */}
        {step === 'blocked' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span style={{ fontSize: 28 }}>⚠️</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: CHARCOAL, marginBottom: 8 }}>Compte inaccessible</h2>
            <p style={{ fontSize: 14, color: TAUPE, marginBottom: 32, lineHeight: 1.6 }}>{blockedMsg || t.profile_edit.reactivate_permanently_deleted}</p>
            <Button fullWidth variant='outline' onClick={() => router.push('/login')}>{'Retour à la connexion'}</Button>
          </div>
        )}

        {/* —— ETAPE EMAIL —— */}
        {step === 'email' && (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: CHARCOAL, marginBottom: 8 }}>{t.profile_edit.reactivate_title}</h2>
            <p style={{ fontSize: 14, color: TAUPE, marginBottom: 28, lineHeight: 1.6 }}>{t.profile_edit.reactivate_desc}</p>
            <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label={t.auth.email_label}
                type='email'
                placeholder={t.auth.email_placeholder}
                leftIcon={<Mail size={15} color={TAUPE} />}
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                error={error}
              />
              <Button type='submit' fullWidth loading={loading} size='lg'>{t.profile_edit.reactivate_send_code}</Button>
            </form>
            <Link href='/login' style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, fontSize: 13, color: TAUPE, textDecoration: 'none', justifyContent: 'center' }}>
              <ArrowLeft size={14} /> {'Retour à la connexion'}
            </Link>
          </>
        )}

        {/* —— ETAPE CODE —— */}
        {step === 'code' && (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: CHARCOAL, marginBottom: 8 }}>{t.profile_edit.reactivate_title}</h2>
            <p style={{ fontSize: 14, color: TAUPE, marginBottom: 28, lineHeight: 1.6 }}>{t.profile_edit.reactivate_code_desc}</p>
            <OtpInput length={6} value={code} onChange={setCode} error={error || undefined} />
            {error && <p style={{ fontSize: 12, color: RED, marginTop: 8 }}>{error}</p>}
            <Button fullWidth loading={loading} size='lg' style={{ marginTop: 20 }} onClick={handleConfirm}>{t.profile_edit.reactivate_confirm}</Button>
            <button type='button' onClick={() => { setStep('email'); setCode(''); setError('') }}
              style={{ display: 'block', margin: '16px auto 0', fontSize: 13, color: TAUPE, background: 'none', border: 'none', cursor: 'pointer' }}>
              <ArrowLeft size={14} style={{ display: 'inline', marginRight: 4 }} /> Changer d'email
            </button>
          </>
        )}

      </div>
    </div>
  )
}
