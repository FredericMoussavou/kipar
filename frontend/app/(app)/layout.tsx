'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import BottomNav from '@/components/layout/BottomNav'
import TopNav from '@/components/layout/TopNav'
import { BG } from '@/lib/theme'
import { NotificationsProvider } from '@/contexts/notifications.context'
import TawkButton from '@/components/ui/kipar/TawkButton'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
  }, [])

  return (
    <NotificationsProvider>
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