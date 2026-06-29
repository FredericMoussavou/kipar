'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button, Input, PasswordStrengthHints } from '@/components/ui/kipar'
import { useTranslation } from '@/hooks/useTranslation'
import api from '@/lib/api'
import { setLangCookie, getLangCookie, SupportedLang } from '@/lib/langCookie'
import { RED, CHARCOAL, TAUPE, BG, WHITE, BORDER, SAND } from '@/lib/theme'
import { useResponsive } from '@/hooks/useResponsive'
import TurnstileWidget from '@/components/ui/TurnstileWidget'

const makeSchema = (t: any) => z.object({
  first_name: z.string().min(2, t.auth.first_name_required),
  last_name: z.string().min(2, t.auth.last_name_required),
  email: z.string().email(t.auth.email_invalid),
  password: z.string().min(8, t.auth.pwd_err_min),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: t.profile_edit.error_password_mismatch,
  path: ['confirm_password'],
})

type FormData = z.infer<ReturnType<typeof makeSchema>>

function useCountUp(target: number, duration: number = 2000) {
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
  return { value, ref }
}

function AnimatedStat({ target, suffix, label }: { target: number; suffix: string; label: string }) {
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

export default function RegisterPage() {
  const { t } = useTranslation()
  const schema = useMemo(() => makeSchema(t), [t])
  const router = useRouter()
  const { paddingV } = useResponsive()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [cguAccepted, setCguAccepted] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const watchedPassword = watch('password') ?? ''

  const onSubmit = async (data: FormData) => {
    try {
      const currentLang = getLangCookie()
      const _pending = new URLSearchParams(window.location.search).get('pending_trip')
        || (typeof window !== 'undefined' ? localStorage.getItem('kipar_pending_trip') : null)
        || undefined
      await api.post('/auth/register', {
        turnstile_token: turnstileToken,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        password: data.password,
        language: currentLang,
        cgu_accepted: cguAccepted,
        pending_trip_id: _pending,
      })
      toast.success('Compte créé avec succès !')
      if (typeof window !== 'undefined') localStorage.removeItem('kipar_pending_trip')
      router.push('/onboarding')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => e.message).join(' — ')
        : detail || t.errors.generic
      toast.error(msg)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', background: BG, overflow: 'hidden' }}>

      {/* Colonne gauche — Formulaire */}
      <div style={{ flex: 1, background: WHITE, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: paddingV, overflowY: 'auto', height: '100vh' }}>
        <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>

          {/* Logo */}
          <div style={{ marginBottom: 28, paddingTop: 24 }}>
            <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 28, fontWeight: 900, color: CHARCOAL, letterSpacing: '-0.02em' }}>
              KIPAR<AnimatedDot />
            </h1>
          </div>

          <h2 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 24, fontWeight: 800, color: CHARCOAL, marginBottom: 6 }}>
            {t.auth.register_title}
          </h2>
          <p style={{ fontSize: 14, color: TAUPE, marginBottom: 28 }}>{t.auth.register_subtitle}</p>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label={t.auth.first_name}
                placeholder={t.auth.first_name_placeholder}
                leftIcon={<User size={15} color={TAUPE} />}
                error={errors.first_name?.message}
                {...register('first_name')}
              />
              <Input
                label={t.auth.last_name}
                placeholder={t.auth.last_name_placeholder}
                error={errors.last_name?.message}
                {...register('last_name')}
              />
            </div>

            <Input
              label={t.auth.email_label}
              type="email"
              placeholder={t.auth.email_placeholder}
              leftIcon={<Mail size={15} color={TAUPE} />}
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label={t.auth.password_label}
              type={showPassword ? 'text' : 'password'}
              placeholder={t.auth.password_min_placeholder}
              leftIcon={<Lock size={15} color={TAUPE} />}
              rightIcon={
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showPassword ? <EyeOff size={15} color={TAUPE} /> : <Eye size={15} color={TAUPE} />}
                </button>
              }
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordStrengthHints password={watchedPassword} />

            <Input
              label={t.auth.confirm_password}
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              leftIcon={<Lock size={15} color={TAUPE} />}
              rightIcon={
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showConfirm ? <EyeOff size={15} color={TAUPE} /> : <Eye size={15} color={TAUPE} />}
                </button>
              }
              error={errors.confirm_password?.message}
              {...register('confirm_password')}
            />

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 0' }}>
              <input
                type="checkbox"
                id="cgu"
                checked={cguAccepted}
                onChange={e => setCguAccepted(e.target.checked)}
                style={{ marginTop: 2, accentColor: RED, width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
              />
              <label htmlFor="cgu" style={{ fontSize: 12, color: TAUPE, lineHeight: 1.6, cursor: 'pointer' }}>
                {t.auth.accept_prefix}{' '}
                <a href="/cgu" target="_blank" style={{ color: RED, fontWeight: 600, textDecoration: 'none' }}>{t.auth.terms_link}</a>
                {' '}{t.auth.accept_middle}{' '}
                <a href="/privacy" target="_blank" style={{ color: RED, fontWeight: 600, textDecoration: 'none' }}>{t.auth.privacy_link}</a>
              </label>
            </div>

            <Button type="submit" fullWidth loading={isSubmitting} size="lg" disabled={!cguAccepted || isSubmitting}>
              {t.auth.register_btn}
            </Button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, color: TAUPE, marginTop: 24 }}>
            {t.auth.already_account}{' '}
            <Link href="/login" style={{ color: RED, fontWeight: 600, textDecoration: 'none' }}>
              {t.auth.sign_in}
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
            <AnimatedStat target={49} suffix="★" label={t.auth.stat_rating} />
          </div>
        </div>
      </div>

    </div>
  )
}
