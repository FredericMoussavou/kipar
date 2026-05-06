'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, Bell, Package2 } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import { useNotifications } from '@/contexts/notifications.context'
import { useBookingStore } from '@/stores/booking.store'
import TripCard from '@/components/trips/TripCard'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { RED, CHARCOAL, TAUPE, SAND, BORDER, WHITE } from '@/lib/theme'

const CORRIDORS = [
  { label: 'Tous', origin: null, dest: null },
  { label: 'CDG → DSS', origin: 'CDG', dest: 'DSS' },
  { label: 'CDG → ABJ', origin: 'CDG', dest: 'ABJ' },
  { label: 'CDG → LBV', origin: 'CDG', dest: 'LBV' },
  { label: 'ORY → DLA', origin: 'ORY', dest: 'DLA' },
  { label: 'CDG → LOS', origin: 'CDG', dest: 'LOS' },
]

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const router = useRouter()
  const { setSelectedTrip } = useBookingStore()
  const { unreadCount } = useNotifications()
  const [activeCorr, setActiveCorr] = useState(0)
  const corridor = CORRIDORS[activeCorr]

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['trips', corridor.origin, corridor.dest],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (corridor.origin) params.set('origin', corridor.origin)
      if (corridor.dest) params.set('destination', corridor.dest)
      const res = await api.get(`/trips?${params}`)
      return res.data
    },
  })

  const handleTripClick = (trip: any) => {
    setSelectedTrip(trip)
    router.push(`/trips/${trip.id}`)
  }

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>

      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80"
        minHeight={200}
      >
        <div style={{ padding: '48px 24px 28px' }} className="md:p-8">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>{t.dashboard.greeting} 👋</p>
              <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}
                className="md:text-3xl">
                {user?.first_name} {user?.last_name}
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{t.dashboard.hero_sub}</p>
            </div>
            <div style={{ display: 'flex',flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Link href="/notifications" className="flex md:hidden" style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textDecoration: 'none' }}>
                <Bell size={18} color="#fff" />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: '#DC0029', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/search">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '10px 16px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.25)' }}>
                  <Search size={15} color="rgba(255,255,255,0.9)" />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{t.dashboard.search_placeholder}</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </HeroHeader>

      {/* Corridors */}
      <div style={{ padding: '20px 20px 0' }} className="md:px-0">
        <p style={{ fontSize: 11, fontWeight: 700, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          {t.dashboard.popular_corridors}
        </p>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {CORRIDORS.map((c, i) => (
            <button key={i} onClick={() => setActiveCorr(i)} style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeCorr === i ? RED : WHITE,
              color: activeCorr === i ? WHITE : CHARCOAL,
              boxShadow: activeCorr === i ? '0 2px 8px rgba(220,0,41,0.25)' : '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trajets */}
      <div style={{ padding: '20px 20px 0' }} className="md:px-0">
        <p style={{ fontSize: 11, fontWeight: 700, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          {t.dashboard.available_trips}
        </p>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 140, background: WHITE, borderRadius: 14, border: `1px solid ${BORDER}` }} />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: SAND, marginBottom: 16 }}>
              <Package2 size={36} color={TAUPE} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.dashboard.no_trips}</p>
            <p style={{ color: TAUPE, fontSize: 13 }}>{t.dashboard.no_trips_sub}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
            {trips.map((trip: any) => (
              <TripCard key={trip.id} trip={trip} onClick={() => handleTripClick(trip)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}