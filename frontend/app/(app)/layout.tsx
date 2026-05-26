'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import BottomNav from '@/components/layout/BottomNav'
import TopNav from '@/components/layout/TopNav'
import { BG } from '@/lib/theme'
import { NotificationsProvider } from '@/contexts/notifications.context'
import TawkButton from '@/components/ui/kipar/TawkButton'
import Drawer from '@/components/layout/Drawer'
import { useDrawerStore } from '@/stores/drawer.store'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, silentRefresh } = useAuthStore()
  const [hydrated, setHydrated] = useState(false)
  const { isOpen: drawerOpen, close: closeDrawer } = useDrawerStore()
  useInactivityLogout()

  useEffect(() => {
    const handleLogout = () => router.replace('/login')
    window.addEventListener('kipar:logout', handleLogout)
    return () => window.removeEventListener('kipar:logout', handleLogout)
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      // Si token present mais potentiellement expire, tenter un silent refresh
      const token = localStorage.getItem('kipar_token')
      if (token) {
        const refreshed = await silentRefresh()
        if (!refreshed && !useAuthStore.getState().isAuthenticated()) {
          useAuthStore.getState().logout()
          return
        }
      }
    }
    const unsub = useAuthStore.persist.onFinishHydration(async () => {
      setHydrated(true)
      await initAuth()
      if (!useAuthStore.getState().isAuthenticated() && window.location.pathname !== '/login') router.replace('/login')
    })
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
      initAuth().then(() => {
        if (!isAuthenticated() && window.location.pathname !== '/login') router.replace('/login')
      })
    }
    return () => unsub()
  }, [])


  if (!hydrated) return <div style={{ minHeight: '100vh', background: '#F5F2EE' }} />

  return (
    <NotificationsProvider>
    <Drawer isOpen={drawerOpen} onClose={closeDrawer} />
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