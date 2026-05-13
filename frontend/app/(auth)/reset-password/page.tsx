'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Button, Input } from '@/components/ui/kipar'
import api from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { RED, CHARCOAL, TAUPE, WHITE, BORDER, BG } from '@/lib/theme'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) setError('Lien invalide ou expiré.')
  }, [token])

  const validate = () => {
    if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères'
    if (!/[A-Z]/.test(password)) return 'Au moins une majuscule requise'
    if (!/[0-9]/.test(password)) return 'Au moins un chiffre requis'
    if (password !== confirm) return 'Les mots de passe ne correspondent pas'
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Lien invalide ou expiré.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: WHITE, borderRadius: 20, padding: 40, boxShadow: '0 4px 32px rgba(0,0,0,0.06)' }}>

        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 24, fontWeight: 900, color: CHARCOAL, marginBottom: 32, letterSpacing: '-0.02em' }}>
          KIPAR<span style={{ color: RED }}>.</span>
        </h1>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle size={32} color="#16A34A" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: CHARCOAL, marginBottom: 8 }}>Mot de passe modifié</h2>
            <p style={{ fontSize: 14, color: TAUPE, marginBottom: 8 }}>Redirection automatique dans 3 secondes...</p>
            <Link href="/login" style={{ fontSize: 13, color: RED, textDecoration: 'none', fontWeight: 600 }}>
              Se connecter maintenant
            </Link>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: CHARCOAL, marginBottom: 8 }}>
              Nouveau mot de passe
            </h2>
            <p style={{ fontSize: 14, color: TAUPE, marginBottom: 28, lineHeight: 1.6 }}>
              Choisissez un mot de passe sécurisé (8 caractères min., 1 majuscule, 1 chiffre).
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label={t.profile_edit.field_new_password}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                leftIcon={<Lock size={15} color={TAUPE} />}
                rightIcon={
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    {showPassword ? <EyeOff size={15} color={TAUPE} /> : <Eye size={15} color={TAUPE} />}
                  </button>
                }
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
              />
              <Input
                label={t.auth.confirm_password}
                type="password"
                placeholder="••••••••"
                leftIcon={<Lock size={15} color={TAUPE} />}
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError('') }}
                error={error}
              />
              <Button type="submit" fullWidth loading={loading} size="lg" disabled={!token}>
                Réinitialiser le mot de passe
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
