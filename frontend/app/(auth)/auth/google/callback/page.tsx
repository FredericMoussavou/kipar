'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import { setLangCookie, SupportedLang } from '@/lib/langCookie'
import api from '@/lib/api'
import { RED, TAUPE } from '@/lib/theme'

function Spinner() {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid ' + RED, borderTopColor: 'transparent',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ fontSize: 14, color: TAUPE, fontFamily: 'var(--font-sans,DM Sans)' }}>
        Connexion en cours...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function GoogleCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setToken, setUser, setRefreshToken } = useAuthStore()
  const { t } = useTranslation()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
      router.replace('/login')
      return
    }

    const redirectUri = window.location.origin + '/auth/google/callback'

    api.post('/auth/google/code', { code, redirect_uri: redirectUri })
      .then(async (res) => {
        setToken(res.data.access_token)
        if (res.data.refresh_token) setRefreshToken(res.data.refresh_token)
        const me = await api.get('/users/me')
        setUser(me.data)
        if (me.data.language) setLangCookie(me.data.language as SupportedLang)
        if (!me.data.onboarding_completed) {
          router.replace('/onboarding')
        } else {
          router.replace('/dashboard')
        }
      })
      .catch(() => {
        router.replace('/login')
      })
  }, [])

  return <Spinner />
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <GoogleCallbackInner />
    </Suspense>
  )
}