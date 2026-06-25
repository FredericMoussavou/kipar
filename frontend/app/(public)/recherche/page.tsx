'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useResponsive } from '@/hooks/useResponsive'
import PublicTripCard from '@/components/trips/PublicTripCard'
import HeroHeader from '@/components/layout/HeroHeader'
import { useTripSearch } from '@/components/trips/useTripSearch'
import TripSearchBar from '@/components/trips/TripSearchBar'
import TripSearchResults from '@/components/trips/TripSearchResults'
import { publicApi } from '@/lib/api'
import type { AirportSuggestion } from '@/components/trips/AirportInput'

export default function RecherchePubliquePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const isMobile = useIsMobile()
  const { paddingH, fontSizeH2 } = useResponsive()

  // Récupération PUBLIQUE des trajets : publicApi prefixe par /public -> /public/trips
  const fetchTrips = async (params: URLSearchParams): Promise<any[]> => {
    return publicApi<any[]>('/trips?' + params.toString())
  }

  // Recherche d'aéroports : endpoint /airports (hors /public), sans token
  const searchAirports = async (q: string): Promise<AirportSuggestion[]> => {
    const base = process.env.NEXT_PUBLIC_API_URL || ''
    const res = await fetch(`${base}/airports?q=${encodeURIComponent(q)}&limit=5`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.results || []
  }

  const search = useTripSearch({ fetchTrips, searchAirports })

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?w=1200&q=80"
        minHeight={isMobile ? 280 : 220}
      >
        <div style={{ padding: isMobile ? `48px ${paddingH}px 24px` : '32px' }}>
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: fontSizeH2, fontWeight: 800, color: '#fff', marginBottom: 20 }}>
            {t.search.title}
          </h1>
          <TripSearchBar search={search} t={t} isMobile={isMobile} />
        </div>
      </HeroHeader>

      <TripSearchResults
        search={search}
        t={t}
        renderCard={(trip, onClick) => (
          <PublicTripCard
            key={trip.id}
            trip={trip}
            onClick={onClick}
            smallLabel={t.landing.trips_small_only}
            kgLabel={t.landing.trips_kg_left}
            trustLabel={t.landing.trips_trust}
          />
        )}
        onTripClick={(trip) => router.push('/trips/' + trip.id)}
      />
    </div>
  )
}