'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import BottomNav from '@/components/layout/BottomNav'
import TopNav from '@/components/layout/TopNav'
import { BG } from '@/lib/theme'
import { NotificationsProvider } from '@/contexts/notifications.context'
import TawkButton from '@/components/ui/kipar/TawkButton'
import Drawer from '@/components/layout/Drawer'
import { useIsMobile } from '@/hooks/useIsMobile'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [hydrated, setHydrated] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true)
      if (!useAuthStore.getState().isAuthenticated()) router.replace('/login')
    })
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
      if (!isAuthenticated()) router.replace('/login')
    }
    return () => unsub()
  }, [])
  useEffect(() => {
    if (!isMobile) return
    const onStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }
    const onEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
      if (touchStartX.current < 20 && dx > 80 && dy < 50) setDrawerOpen(true)
      touchStartX.current = null
      touchStartY.current = null
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [isMobile])

  if (!hydrated) return null

  return (
    <NotificationsProvider>
    <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    <div style={{ minHeight: '100vh', background: BG }}>
      {/* Desktop top nav */}
      <div className="hidden md:block">
        <TopNav />
      </div>
      {/* Contenu */}
      <main style={{ paddingBottom: 80 }} className="md:max-w-5xl md:mx-auto md:px-6 md:pt-6 md:pb-12">
        {children}
      </main>
      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
      <TawkButton />
      <footer style={{ textAlign: 'center', padding: '16px 20px 80px', display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="/cgu" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>CGU</a>
        <a href="/privacy" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>Confidentialité</a>
        <a href="/mentions-legales" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>Mentions légales</a>
        <a href="/cookies" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>Cookies</a>
      </footer>
    </NotificationsProvider>
  )
}