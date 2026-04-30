'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, Bell } from 'lucide-react'
import Link from 'next/link'

import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import { useBookingStore } from '@/stores/booking.store'
import TripCard from '@/components/trips/TripCard'
import api from '@/lib/api'

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
    <div className="flex flex-col min-h-full">

      {/* Header marine */}
      <div style={{ backgroundColor: '#1B5E4B' }} className="px-5 pt-12 pb-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm opacity-70">{t.dashboard.greeting} 👋</p>
            <h1 className="font-syne text-2xl font-bold mt-0.5">
              {user?.first_name} {user?.last_name}
            </h1>
          </div>
          <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Barre de recherche */}
        <Link href="/search">
          <div className="flex items-center gap-3 bg-white/15 rounded-xl px-4 py-3 mt-2">
            <Search className="w-4 h-4 text-white/70" />
            <span className="text-sm text-white/70">{t.dashboard.search_placeholder}</span>
          </div>
        </Link>
      </div>

      {/* Contenu */}
      <div className="flex-1 px-5 pt-5">

        {/* Corridors */}
        <p className="text-xs font-semibold text-kipar-muted uppercase tracking-wider mb-3">
          {t.dashboard.popular_corridors}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none mb-5">
          {CORRIDORS.map((c, i) => (
            <button
              key={i}
              onClick={() => setActiveCorr(i)}
              className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-all ${
                activeCorr === i
                  ? 'text-white'
                  : 'bg-gray-100 text-kipar-muted hover:bg-gray-200'
              }`}
              style={activeCorr === i ? { backgroundColor: '#1B5E4B' } : {}}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Liste trajets */}
        <p className="text-xs font-semibold text-kipar-muted uppercase tracking-wider mb-3">
          {t.dashboard.available_trips}
        </p>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">✈️</p>
            <p className="text-kipar-muted text-sm">{t.dashboard.no_trips}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {trips.map((trip: any) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onClick={() => handleTripClick(trip)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
