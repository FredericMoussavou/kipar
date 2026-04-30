'use client'

import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useBookingStore } from '@/stores/booking.store'
import TripCard from '@/components/trips/TripCard'
import api from '@/lib/api'

const RED = '#DC0029'
const CHARCOAL = '#3D3D3D'
const TAUPE = '#B5AFAB'
const SAND = '#F0EDE8'
const BORDER = '#EEEBE6'

export default function SearchPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { setSelectedTrip } = useBookingStore()

  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([])
  const [destSuggestions, setDestSuggestions] = useState<any[]>([])
  const [searched, setSearched] = useState(false)

  const { data: trips = [], isLoading, refetch } = useQuery({
    queryKey: ['search-trips', origin, dest],
    enabled: false,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (origin) params.set('origin', origin)
      if (dest) params.set('destination', dest)
      const res = await api.get(`/trips?${params}`)
      return res.data
    },
  })

  const searchAirports = async (q: string, setSuggestions: (s: any[]) => void) => {
    if (q.length < 1) { setSuggestions([]); return }
    try {
      const res = await api.get(`/airports?q=${encodeURIComponent(q)}&limit=5`, { headers: {} })
      setSuggestions(res.data.results || [])
    } catch {
      setSuggestions([])
    }
  }

  const handleSearch = () => {
    setSearched(true)
    setOriginSuggestions([])
    setDestSuggestions([])
    refetch()
  }

  const handleTripClick = (trip: any) => {
    setSelectedTrip(trip)
    router.push(`/trips/${trip.id}`)
  }

  return (
    <div style={{ background: '#FBFBFF', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: RED, padding: '48px 20px 20px', color: '#fff', borderRadius: '20px' }}>
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
          {t.search.title}
        </h1>

        {/* Origine */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>
            {t.search.origin_label}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 12, padding: '10px 14px' }}>
            <Search size={15} color="#B5AFAB" />
            <input
              value={origin}
              onChange={e => {
                setOrigin(e.target.value)
                searchAirports(e.target.value, setOriginSuggestions)
              }}
              placeholder={t.search.origin_placeholder}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#3D3D3D', fontSize: 14 }}
            />
            {origin && (
              <button onClick={() => { setOrigin(''); setOriginSuggestions([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={14} color="#B5AFAB" />
              </button>
            )}
          </div>
          {originSuggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', borderRadius: 12, marginTop: 4, overflow: 'hidden', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              {originSuggestions.map((a: any) => (
                <div
                  key={a.code}
                  onClick={() => { setOrigin(a.code); setOriginSuggestions([]) }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${SAND}`, display: 'flex', alignItems: 'center', gap: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = SAND)}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <span style={{ fontFamily: 'var(--font-syne,Syne)', fontWeight: 700, color: CHARCOAL, fontSize: 14 }}>{a.code}</span>
                  <span style={{ fontSize: 13, color: TAUPE }}>{a.city}, {a.country}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Destination */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>
            {t.search.dest_label}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 12, padding: '10px 14px' }}>
            <Search size={15} color="#B5AFAB" />
            <input
              value={dest}
              onChange={e => {
                setDest(e.target.value)
                searchAirports(e.target.value, setDestSuggestions)
              }}
              placeholder={t.search.dest_placeholder}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#3D3D3D', fontSize: 14 }}
            />
            {dest && (
              <button onClick={() => { setDest(''); setDestSuggestions([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={14} color="#B5AFAB" />
              </button>
            )}
          </div>
          {destSuggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', borderRadius: 12, marginTop: 4, overflow: 'hidden', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              {destSuggestions.map((a: any) => (
                <div
                  key={a.code}
                  onClick={() => { setDest(a.code); setDestSuggestions([]) }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${SAND}`, display: 'flex', alignItems: 'center', gap: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = SAND)}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <span style={{ fontFamily: 'var(--font-syne,Syne)', fontWeight: 700, color: CHARCOAL, fontSize: 14 }}>{a.code}</span>
                  <span style={{ fontSize: 13, color: TAUPE }}>{a.city}, {a.country}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 20}}>
          <button
            onClick={handleSearch}
            style={{background: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 600, color: RED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Search size={16} />
            {t.search.search_btn}
          </button>
        </div>
      </div>

      {/* Résultats */}
      <div style={{ padding: '20px 20px 80px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 140, background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}` }} />
            ))}
          </div>
        ) : searched && trips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <p style={{ fontSize: 32, marginBottom: 10 }}>✈️</p>
            <p style={{ color: TAUPE, fontSize: 14 }}>{t.search.no_results}</p>
          </div>
        ) : trips.length > 0 ? (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              {trips.length} trajet{trips.length > 1 ? 's' : ''} trouvé{trips.length > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trips.map((trip: any) => (
                <TripCard key={trip.id} trip={trip} onClick={() => handleTripClick(trip)} />
              ))}
            </div>
          </>
        ) : !searched ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <p style={{ fontSize: 32, marginBottom: 10 }}>🔍</p>
            <p style={{ color: TAUPE, fontSize: 14 }}>Entrez une destination pour rechercher des trajets</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}