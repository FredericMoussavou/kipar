'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return }
    // Attend que le store soit rehydrate
    if (user === null) return
    if (!user.is_admin) { router.replace('/dashboard'); return }
    setReady(true)
  }, [user])

  if (!ready) return null
  return <>{children}</>
}
