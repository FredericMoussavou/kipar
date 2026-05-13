'use client'
import { useCallback, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getLangCookie, setLangCookie, SupportedLang, SUPPORTED_LANGS } from '@/lib/langCookie'
import api from '@/lib/api'

function detectBrowserLang(): SupportedLang {
  if (typeof navigator === 'undefined') return 'fr'
  const browserLang = navigator.language.slice(0, 2).toLowerCase()
  return (SUPPORTED_LANGS as readonly string[]).includes(browserLang)
    ? browserLang as SupportedLang
    : 'fr'
}

export function useLanguage() {
  const { user, patchUser } = useAuthStore()

  // Initialiser le cookie si absent
  useEffect(() => {
    const cookie = getLangCookie()
    if (!cookie) {
      const detected = user?.language as SupportedLang || detectBrowserLang()
      setLangCookie(detected)
    }
  }, [user?.language])

  const currentLang = (user?.language || getLangCookie() || detectBrowserLang()) as SupportedLang

  const setLanguage = useCallback(async (lang: SupportedLang) => {
    setLangCookie(lang)
    if (user) {
      patchUser({ language: lang })
      try {
        await api.patch('/users/me/language', { language: lang })
      } catch {}
    }
  }, [user, patchUser])

  return { currentLang, setLanguage }
}
