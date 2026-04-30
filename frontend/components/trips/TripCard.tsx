'use client'

import { MapPin, Calendar, Package } from 'lucide-react'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/useTranslation'

interface Trip {
  id: string
  origin_airport_code: string
  destination_airport_code: string
  origin_city: string
  destination_city: string
  departure_date: string
  flight_number: string | null
  remaining_kg: number
  max_kg_per_package: number
  price_per_kg: number
  trust_score?: number
  status: string
}

interface TripCardProps {
  trip: Trip
  onClick: () => void
  className?: string
}

export default function TripCard({ trip, onClick, className }: TripCardProps) {
  const { t } = useTranslation()
  const score = Math.round(trip.trust_score || 0)
  const scorePct = Math.min(score, 100)
  const scoreColor = scorePct >= 70 ? '#1B5E4B' : scorePct >= 40 ? '#F59E0B' : '#EF4444'

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-kipar-border rounded-xl p-4 cursor-pointer',
        'hover:border-kipar-green hover:shadow-kipar transition-all active:scale-[0.99]',
        className
      )}
    >
      {/* Route */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="font-syne text-xl font-bold text-kipar-text">
              {trip.origin_airport_code}
            </p>
            <p className="text-xs text-kipar-muted">{trip.origin_city}</p>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-16 flex items-center gap-1">
              <div className="flex-1 h-px bg-kipar-border" />
              <span className="text-xs">✈️</span>
              <div className="flex-1 h-px bg-kipar-border" />
            </div>
          </div>
          <div className="text-center">
            <p className="font-syne text-xl font-bold text-kipar-text">
              {trip.destination_airport_code}
            </p>
            <p className="text-xs text-kipar-muted">{trip.destination_city}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-syne text-xl font-bold" style={{ color: '#1B5E4B' }}>
            {trip.price_per_kg}€
          </p>
          <p className="text-xs text-kipar-muted">{t.trip.price_per_kg}</p>
        </div>
      </div>

      {/* Infos */}
      <div className="flex items-center gap-3 text-xs text-kipar-muted mb-3">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{trip.departure_date}</span>
        </div>
        {trip.flight_number && (
          <div className="flex items-center gap-1">
            <span>✈</span>
            <span>{trip.flight_number}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Package className="w-3.5 h-3.5" />
          <span>{trip.remaining_kg} kg</span>
        </div>
      </div>

      {/* Tags + Trust */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <span className="text-xs px-2.5 py-1 rounded-pill bg-green-50 text-kipar-green font-medium">
            {trip.remaining_kg} kg dispo
          </span>
          <span className="text-xs px-2.5 py-1 rounded-pill bg-gray-100 text-kipar-muted font-medium">
            Max {trip.max_kg_per_package} kg
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" style={{ color: scoreColor }} />
          <div className="w-16 h-1.5 bg-gray-100 rounded-pill overflow-hidden">
            <div
              className="h-full rounded-pill transition-all"
              style={{ width: `${scorePct}%`, backgroundColor: scoreColor }}
            />
          </div>
          <span className="text-xs font-medium" style={{ color: scoreColor }}>
            {score}
          </span>
        </div>
      </div>
    </div>
  )
}
