'use client'

import { useAuthStore } from '@/stores/auth.store'
import { getT } from '@/lib/i18n'

export function useTranslation() {
  const user = useAuthStore((s) => s.user)
  const lang = user?.language || 'fr'
  const t = getT(lang)
  return { t, lang }
}
