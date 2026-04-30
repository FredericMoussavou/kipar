"use client"

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useBookingStore } from '@/stores/booking.store'
import TripCard from '@/components/trips/TripCard'
import api from '@/lib/api'
import { RED, CHARCOAL, TAUPE, SAND, BORDER } from '@/lib/theme'

export default function SearchPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { setSelectedTrip } = useBookingStore()

  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [date, setDate] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([])
  const [destSuggestions, setDestSuggestions] = useState<any[]>([])
  const [searched, setSearched] = useState(false)

  const { data: trips = [], isLoading, refetch } = useQuery({
    queryKey: ['search-trips', origin, dest, date, sortBy],
    enabled: false,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (origin) params.set('origin', origin)
      if (dest) params.set('destination', dest)
      if (date) params.set('date', date)
      if (sortBy) params.set('sort_by', sortBy)
      const res = await api.get('/trips?' + params.toString())
      return res.data
    },
  })

  const searchAirports = async (q: string, setSuggestions: (s: any[]) => void) => {
    if (q.length < 1) { setSuggestions([]); return }
    try {
      const res = await api.get('/airports?q=' + encodeURIComponent(q) + '&limit=5', { headers: {} })
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
    router.push('/trips/' + trip.id)
  }

  return (
    <div style={{ background: '#FBFBFF', minHeight: '100vh' }}>

      {/* Header rouge */}
      <div style={{ background: RED, padding: '48px 20px 24px', borderRadius: '0 0 24px 24px' }}>
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 20 }}>
          {t.search.title}
        </h1>

        {/* Grid 2 colonnes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>

          {/* Colonne gauche : Départ + Destination */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.search.origin_label}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 10, padding: '10px 12px' }}>
                <Search size={13} color={TAUPE} />
                <input
                  value={origin}
                  onChange={e => { setOrigin(e.target.value); searchAirports(e.target.value, setOriginSuggestions) }}
                  placeholder={t.search.origin_placeholder}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: CHARCOAL, fontSize: 13, minWidth: 0 }}
                />
                {origin && (
                  <button onClick={() => { setOrigin(''); setOriginSuggestions([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <X size={12} color={TAUPE} />
                  </button>
                )}
              </div>
              {originSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', borderRadius: 10, marginTop: 4, overflow: 'hidden', zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                  {originSuggestions.map((a: any) => (
                    <div key={a.code} onClick={() => { setOrigin(a.code); setOriginSuggestions([]) }}
                      style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid ' + SAND, display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={e => (e.currentTarget.style.background = SAND)}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                      <span style={{ fontFamily: 'var(--font-syne,Syne)', fontWeight: 700, color: CHARCOAL, fontSize: 13 }}>{a.code}</span>
                      <span style={{ fontSize: 11, color: TAUPE }}>{a.city}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.search.dest_label}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 10, padding: '10px 12px' }}>
                <Search size={13} color={TAUPE} />
                <input
                  value={dest}
                  onChange={e => { setDest(e.target.value); searchAirports(e.target.value, setDestSuggestions) }}
                  placeholder={t.search.dest_placeholder}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: CHARCOAL, fontSize: 13, minWidth: 0 }}
                />
                {dest && (
                  <button onClick={() => { setDest(''); setDestSuggestions([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <X size={12} color={TAUPE} />
                  </button>
                )}
              </div>
              {destSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', borderRadius: 10, marginTop: 4, overflow: 'hidden', zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                  {destSuggestions.map((a: any) => (
                    <div key={a.code} onClick={() => { setDest(a.code); setDestSuggestions([]) }}
                      style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid ' + SAND, display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={e => (e.currentTarget.style.background = SAND)}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                      <span style={{ fontFamily: 'var(--font-syne,Syne)', fontWeight: 700, color: CHARCOAL, fontSize: 13 }}>{a.code}</span>
                      <span style={{ fontSize: 11, color: TAUPE }}>{a.city}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Colonne droite : Date + Tri */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.search.filter_date}</p>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ width: '100%', background: '#fff', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: date ? CHARCOAL : TAUPE, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.search.filter_sort}</p>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ width: '100%', background: '#fff', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: CHARCOAL, outline: 'none', boxSizing: 'border-box' }}>
                <option value="">{t.search.sort_date}</option>
                <option value="price_asc">{t.search.sort_price_asc}</option>
                <option value="price_desc">{t.search.sort_price_desc}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bouton centré compact */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={handleSearch}
            style={{ background: '#fff', border: 'none', borderRadius: 99, padding: '12px 36px', fontSize: 14, fontWeight: 700, color: RED, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <Search size={15} />
            {t.search.search_btn}
          </button>
        </div>
      </div>

      {/* Résultats */}
      <div style={{ padding: '20px 20px 80px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 140, background: '#fff', borderRadius: 16, border: '1px solid ' + BORDER }} />
            ))}
          </div>
        ) : searched && trips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: '#F0EDE8', marginBottom: 16 }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 20L14 12L18 16L24 8L30 14" stroke="#B5AFAB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M4 26H10L14 18L19 22L23 14L28 20H32" stroke="#B5AFAB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.search.no_results}</p>
            <p style={{ color: TAUPE, fontSize: 13 }}>{t.search.no_results_sub}</p>
          </div>
        ) : trips.length > 0 ? (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              {trips.length} {trips.length > 1 ? t.search.results_count_plural : t.search.results_count}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {trips.map((trip: any) => (
                <TripCard key={trip.id} trip={trip} onClick={() => handleTripClick(trip)} />
              ))}
            </div>
          </>
            ) : searched ? null : (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: '#F0EDE8', marginBottom: 16 }}>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="9" stroke="#B5AFAB" strokeWidth="2.5" fill="none"/>
                    <line x1="22.5" y1="22.5" x2="30" y2="30" stroke="#B5AFAB" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.search.empty_title}</p>
                <p style={{ color: TAUPE, fontSize: 13 }}>{t.search.empty_subtitle}</p>
              </div>
            )}
      </div>
    </div>
  )
}