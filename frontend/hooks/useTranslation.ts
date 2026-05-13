'use client'
import { useAuthStore } from '@/stores/auth.store'
import { getT } from '@/lib/i18n'
import { getLangCookie } from '@/lib/langCookie'

export function useTranslation() {
  const user = useAuthStore((s) => s.user)
  const lang = user?.language || getLangCookie() || 'fr'
  const t = getT(lang)
  return { t, lang }
}
