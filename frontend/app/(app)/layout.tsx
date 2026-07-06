'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import BottomNav from '@/components/layout/BottomNav'
import TopNav from '@/components/layout/TopNav'
import VisitorNav from '@/components/layout/VisitorNav'
import { BG } from '@/lib/theme'
import { NotificationsProvider } from '@/contexts/notifications.context'
import TawkButton from '@/components/ui/kipar/TawkButton'
import Drawer from '@/components/layout/Drawer'
import { useDrawerStore } from '@/stores/drawer.store'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { useTranslation } from '@/hooks/useTranslation'
import PlatformReviewModal from '@/components/ui/kipar/PlatformReviewModal'
import api from '@/lib/api'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const hideNav = pathname?.includes('/book/payment') ?? false
  const { isAuthenticated, silentRefresh } = useAuthStore()
  const [hydrated, setHydrated] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [canReview, setCanReview] = useState(false)
  const { isOpen: drawerOpen, close: closeDrawer } = useDrawerStore()
  useInactivityLogout()
  useEffect(() => {
    if (!isAuthenticated()) return
    api.get('/reviews/platform/me').then(res => setCanReview(!!res.data?.can_review)).catch(() => {})
  }, [isAuthenticated])

  useEffect(() => {
    const hadToken = typeof window !== 'undefined' && !!(localStorage.getItem('kipar_token') || localStorage.getItem('kipar_refresh_token'))
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
      if (!useAuthStore.getState().isAuthenticated() && window.location.pathname !== '/login') {
        const _p = window.location.pathname
        if (_p.startsWith('/trips/')) {
          if (hadToken) {
            const _tid = _p.split('/trips/')[1]?.split('/')[0]
            router.replace(_tid ? `/login?pending_trip=${_tid}` : '/login')
          }
        } else {
          router.replace('/login')
        }
      }
    })
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
      initAuth().then(() => {
        if (!isAuthenticated() && window.location.pathname !== '/login') {
        const _p = window.location.pathname
        if (_p.startsWith('/trips/')) {
          if (hadToken) {
            const _tid = _p.split('/trips/')[1]?.split('/')[0]
            router.replace(_tid ? `/login?pending_trip=${_tid}` : '/login')
          }
        } else {
          router.replace('/login')
        }
      }
      })
    }
    return () => unsub()
  }, [])


  if (!hydrated) return <div style={{ minHeight: '100vh', background: '#F5F2EE' }} />

  return (
    <NotificationsProvider>
    {/* hide-on-payment:drawer */}
    {!hideNav && <div className="md:hidden"><Drawer isOpen={drawerOpen} onClose={closeDrawer} /></div>}
    <div style={{ minHeight: '100vh', background: BG }}>
      {/* hide-on-payment:topnav */}
      {!hideNav && (
      <div className="hidden md:block">
        {isAuthenticated() ? <TopNav /> : <VisitorNav />}
      </div>
      )}
      {/* Contenu */}
      <main style={{ paddingBottom: 80 }} className="md:max-w-5xl md:mx-auto md:px-6 md:pt-6 md:pb-12">
        {children}
      </main>
      {/* hide-on-payment:bottomnav */}
      {!hideNav && (
      <div className="md:hidden">
        <BottomNav />
      </div>
      )}
    </div>
      {!hideNav && <TawkButton />}
      <footer style={{ textAlign: 'center', padding: '16px 20px 80px', display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
        {canReview && (
          <button onClick={() => setShowReviewModal(true)} style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>{t.footer.give_review}</button>
        )}
        <a href="/cgu" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>{t.footer.terms}</a>
        <a href="/privacy" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>{t.footer.privacy}</a>
        <a href="/mentions-legales" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>{t.footer.legal}</a>
        <a href="/cookies" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>{t.footer.cookies}</a>
        <a href="/faq" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>{t.footer.faq}</a>
      </footer>
      <PlatformReviewModal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} />
    </NotificationsProvider>
  )
}