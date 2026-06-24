'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getLangCookie } from '@/lib/langCookie'

export default function LangSync() {
  const user = useAuthStore((s) => s.user)
  useEffect(() => {
    const lang = user?.language || getLangCookie() || 'fr'
    if (document.documentElement.lang !== lang) {
      document.documentElement.lang = lang
    }
  }, [user?.language])
  return null
}
