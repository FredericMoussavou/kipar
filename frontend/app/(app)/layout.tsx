'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import BottomNav from '@/components/layout/BottomNav'
import TopNav from '@/components/layout/TopNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop top nav */}
      <div className="hidden md:block">
        <TopNav />
      </div>

      {/* Contenu */}
      <main className={`
        md:max-w-5xl md:mx-auto md:px-6 md:pt-6 md:pb-12
        pb-20 md:pb-12
      `}>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
