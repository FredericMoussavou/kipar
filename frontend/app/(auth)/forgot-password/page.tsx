'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'
import { Button, Input } from '@/components/ui/kipar'
import api from '@/lib/api'
import { RED, CHARCOAL, TAUPE, WHITE, BORDER, SAND, BG } from '@/lib/theme'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email requis'); return }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      setSent(true)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Une erreur est survenue')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: WHITE, borderRadius: 20, padding: 40, boxShadow: '0 4px 32px rgba(0,0,0,0.06)' }}>

        {/* Logo */}
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 24, fontWeight: 900, color: CHARCOAL, marginBottom: 32, letterSpacing: '-0.02em' }}>
          KIPAR<span style={{ color: RED }}>.</span>
        </h1>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle size={32} color="#16A34A" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: CHARCOAL, marginBottom: 8 }}>Email envoyé</h2>
            <p style={{ fontSize: 14, color: TAUPE, marginBottom: 32, lineHeight: 1.6 }}>
              Si un compte existe avec cet email, vous recevrez un lien de réinitialisation valable 15 minutes.
            </p>
            <Button fullWidth onClick={() => router.push('/login')}>Retour à la connexion</Button>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: CHARCOAL, marginBottom: 8 }}>
              Mot de passe oublié
            </h2>
            <p style={{ fontSize: 14, color: TAUPE, marginBottom: 28, lineHeight: 1.6 }}>
              Saisissez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label={t.auth.email_label}
                type="email"
                placeholder={t.auth.email_placeholder}
                leftIcon={<Mail size={15} color={TAUPE} />}
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                error={error}
              />
              <Button type="submit" fullWidth loading={loading} size="lg">
                Envoyer le lien
              </Button>
            </form>

            <Link href="/login" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, fontSize: 13, color: TAUPE, textDecoration: 'none', justifyContent: 'center' }}>
              <ArrowLeft size={14} /> Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
