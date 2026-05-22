'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button, Input } from '@/components/ui/kipar'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import api from '@/lib/api'
import { setLangCookie, SupportedLang } from '@/lib/langCookie'
import { RED, CHARCOAL, TAUPE, BG, WHITE, BORDER, SAND } from '@/lib/theme'

const schema = z.object({
  email: z.string().min(1, 'Email requis'),
  password: z.string().min(6, 'Mot de passe trop court'),
})

type FormData = z.infer<typeof schema>

function useCountUp(target: number, duration: number = 2000, suffix: string = '') {
  const [value, setValue] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started) setStarted(true)
    })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    const steps = 60
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) { setValue(target); clearInterval(timer) }
      else setValue(Math.floor(current))
    }, duration / steps)
    return () => clearInterval(timer)
  }, [started, target, duration])

  return { value, suffix, ref }
}

function AnimatedStat({ target, suffix, label }: { target: number, suffix: string, label: string }) {
  const { value, ref } = useCountUp(target, 1800)
  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 32, fontWeight: 900, color: CHARCOAL, margin: 0 }}>
        {value}{suffix}
      </p>
      <p style={{ fontSize: 12, color: TAUPE, marginTop: 4 }}>{label}</p>
    </div>
  )
}

function AnimatedDot() {
  const colors = [RED, '#F97316', '#FBBF24', '#DC0029']
  const [colorIndex, setColorIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setColorIndex(i => (i + 1) % colors.length)
    }, 800)
    return () => clearInterval(timer)
  }, [])

  return (
    <span style={{ color: colors[colorIndex], transition: 'color 0.4s ease', display: 'inline-block' }}>.</span>
  )
}

export default function LoginPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { setToken, setUser, setRefreshToken } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post('/auth/login', data)
      setToken(res.data.access_token)
      if (res.data.refresh_token) setRefreshToken(res.data.refresh_token)
      const userData = res.data.user
      if (userData) {
        setUser(userData)
        if (userData.language) setLangCookie(userData.language as SupportedLang)
        if (!userData.onboarding_completed) {
          router.push('/onboarding')
        } else {
          router.push('/dashboard')
        }
      } else {
        const me = await api.get('/users/me')
        setUser(me.data)
        if (me.data.language) setLangCookie(me.data.language as SupportedLang)
        if (!me.data.onboarding_completed) {
          router.push('/onboarding')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t.errors.invalid_credentials)
    }
  }

  const handleOAuthCallback = async (provider: 'google' | 'apple', id_token: string, first_name?: string, last_name?: string) => {
    try {
      const res = await api.post(`/auth/${provider}`, { id_token, first_name, last_name })
      setToken(res.data.access_token)
      if (res.data.refresh_token) setRefreshToken(res.data.refresh_token)
      const me = await api.get('/users/me')
      setUser(me.data)
      if (me.data.language) setLangCookie(me.data.language as SupportedLang)
      if (!me.data.onboarding_completed) {
        router.push('/onboarding')
      } else {
        router.push('/dashboard')
      }
    } catch {
      toast.error(t.errors.generic)
    }
  }

  const handleGoogleLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) { toast.error('Google OAuth non configuré'); return }
    const redirectUri = window.location.origin + '/auth/google/callback'
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      access_type: 'offline',
    })
    window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params
  }

  const handleAppleLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID
    if (!clientId) { toast.error('Apple OAuth non configuré'); return }
    const initApple = () => {
      ;(window as any).AppleID.auth.init({
        clientId,
        scope: 'name email',
        redirectURI: window.location.origin + '/auth/apple/callback',
        usePopup: true,
      })
      ;(window as any).AppleID.auth.signIn()
        .then(async (response: any) => {
          const id_token = response.authorization?.id_token
          const firstName = response.user?.name?.firstName
          const lastName = response.user?.name?.lastName
          if (id_token) await handleOAuthCallback('apple', id_token, firstName, lastName)
        })
        .catch(() => toast.error(t.errors.generic))
    }
    if ((window as any).AppleID?.auth) {
      initApple()
    } else {
      const script = document.createElement('script')
      script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
      script.onload = initApple
      document.head.appendChild(script)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', background: BG, overflow: 'hidden', position: 'fixed', inset: 0 }}>

      {/* Colonne gauche — Formulaire */}
      <div style={{ flex: 1, background: WHITE, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 48, overflowY: 'auto', height: '100vh' }}>
        <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>

          {/* Logo */}
          <div style={{ marginBottom: 32, paddingTop: 24 }}>
            <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 28, fontWeight: 900, color: CHARCOAL, letterSpacing: '-0.02em' }}>
              KIPAR<AnimatedDot />
            </h1>
          </div>

          <h2 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 26, fontWeight: 800, color: CHARCOAL, marginBottom: 8 }}>
            {t.auth.login_title}
          </h2>
          <p style={{ fontSize: 14, color: TAUPE, marginBottom: 32 }}>{t.auth.login_subtitle}</p>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label={t.auth.email_label}
              type="email"
              placeholder={t.auth.email_placeholder}
              leftIcon={<Mail size={15} color={TAUPE} />}
              error={errors.email?.message}
              {...register('email')}
            />

            <div>
              <Input
                label={t.auth.password_label}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                leftIcon={<Lock size={15} color={TAUPE} />}
                rightIcon={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    {showPassword ? <EyeOff size={15} color={TAUPE} /> : <Eye size={15} color={TAUPE} />}
                  </button>
                }
                error={errors.password?.message}
                {...register('password')}
              />
              <div style={{ textAlign: 'right', marginTop: 6 }}>
                <Link href="/forgot-password" style={{ fontSize: 12, color: RED, textDecoration: 'none' }}>
                  {t.auth.forgot_password}
                </Link>
              </div>
            </div>

            <Button type="submit" fullWidth loading={isSubmitting} size="lg">
              {t.auth.login_btn}
            </Button>
          </form>

          {/* Séparateur */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <span style={{ fontSize: 12, color: TAUPE, whiteSpace: 'nowrap' }}>{t.auth.or_connect_with}</span>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>

          {/* OAuth */}
          <button type="button" onClick={handleGoogleLogin} style={{
            width: '100%', padding: '12px 16px', borderRadius: 10,
            background: SAND, border: '1px solid ' + BORDER,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
            color: CHARCOAL, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.87v2.07A8 8 0 008.98 17z"/>
              <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 014.26 9c0-.53.09-1.04.25-1.52V5.41H1.87A8 8 0 001 9c0 1.3.31 2.53.87 3.59l2.64-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.87 5.4L4.5 7.48C5.14 5.6 6.9 4.18 8.98 4.18z"/>
            </svg>
            {t.auth.google}
          </button>

          <p style={{ textAlign: 'center', fontSize: 13, color: TAUPE, marginTop: 28 }}>
            {t.auth.no_account}{' '}
            <Link href="/register" style={{ color: RED, fontWeight: 600, textDecoration: 'none' }}>
              {t.auth.sign_up}
            </Link>
          </p>
        </div>
      </div>

      {/* Colonne droite — Visuel (masquée sur mobile) */}
      <div style={{ flex: 1, background: SAND, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, position: 'relative', overflow: 'hidden', height: '100vh' }}
        className="hidden-mobile">

        {/* Cercles décoratifs */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(0,0,0,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(0,0,0,0.04)' }} />

        {/* Contenu */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 72, fontWeight: 900, color: CHARCOAL, letterSpacing: '-0.04em', lineHeight: 0.9, marginBottom: 24 }}>
            KIPAR<AnimatedDot />
          </h1>
          <p style={{ fontSize: 18, color: TAUPE, fontWeight: 500, marginBottom: 64, lineHeight: 1.5 }}>
            {t.auth.login_subtitle}
          </p>

          {/* Stats animées */}
          <div style={{ display: 'flex', gap: 48, justifyContent: 'center', alignItems: 'center' }}>
            <AnimatedStat target={10} suffix="K+" label={t.auth.stat_carriers} />
            <div style={{ width: 1, height: 40, background: BORDER }} />
            <AnimatedStat target={50} suffix="+" label={t.auth.stat_destinations} />
            <div style={{ width: 1, height: 40, background: BORDER }} />
            <AnimatedStat target={4.9} suffix="★" label={t.auth.stat_rating} />
          </div>
        </div>
      </div>

    </div>
  )
}