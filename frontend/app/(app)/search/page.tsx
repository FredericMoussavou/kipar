"use client"

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useResponsive } from '@/hooks/useResponsive'
import { useBookingStore } from '@/stores/booking.store'
import { useAuthStore } from '@/stores/auth.store'
import TripCard from '@/components/trips/TripCard'
import HeroHeader from '@/components/layout/HeroHeader'
import DatePicker from '@/components/ui/kipar/DatePicker'
import Select from '@/components/ui/kipar/Select'
import api from '@/lib/api'
import { RED, CHARCOAL, TAUPE, SAND, BORDER, WHITE } from '@/lib/theme'

const LIGHT_OVERRIDE: React.CSSProperties = { '--k-bg': '#ffffff', '--k-white': '#ffffff', '--k-charcoal': '#1A1A1A', '--k-border': 'rgba(255,255,255,0.4)' } as React.CSSProperties

function AirportInput({ value, onChange, onSelect, suggestions, onClear, placeholder, label }: {
  value: string
  onChange: (v: string) => void
  onSelect: (a: any) => void
  suggestions: any[]
  onClear: () => void
  placeholder: string
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<any>(null)

  useEffect(() => {
    if (suggestions.length > 0 && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed' as const,
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        background: WHITE,
        borderRadius: 10,
        overflow: 'hidden',
        zIndex: 9999,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      })
    } else {
      setDropdownStyle(null)
    }
  }, [suggestions])

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
      <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.95)', borderRadius: 10, padding: '10px 12px' }}>
        <Search size={13} color={TAUPE} />
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: CHARCOAL, fontSize: 13, minWidth: 0 }}
        />
        {value && (
          <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={12} color={TAUPE} />
          </button>
        )}
      </div>
      {dropdownStyle && suggestions.length > 0 && (
        <div style={dropdownStyle}>
          {suggestions.map((a: any) => (
            <div key={a.code} onClick={() => onSelect(a)}
              style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid ' + SAND, display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = SAND)}
              onMouseLeave={e => (e.currentTarget.style.background = WHITE)}>
              <span style={{ fontFamily: 'var(--font-syne,Syne)', fontWeight: 700, color: CHARCOAL, fontSize: 13 }}>{a.code}</span>
              <span style={{ fontSize: 11, color: TAUPE }}>{a.city}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


export default function SearchPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { setSelectedTrip } = useBookingStore()
  const isMobile = useIsMobile()
  const { paddingH, fontSizeH2 } = useResponsive()

  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [date, setDate] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([])
  const [destSuggestions, setDestSuggestions] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [showOwnTrips, setShowOwnTrips] = useState(false)
  const [showUrgentOnly, setShowUrgentOnly] = useState(false)
  const { user } = useAuthStore()

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

  const airportInputProps = {
    origin: {
      value: origin, label: t.search.origin_label, placeholder: t.search.origin_placeholder,
      suggestions: originSuggestions,
      onChange: (v: string) => { setOrigin(v); searchAirports(v, setOriginSuggestions) },
      onSelect: (a: any) => { setOrigin(a.code); setOriginSuggestions([]) },
      onClear: () => { setOrigin(''); setOriginSuggestions([]) },
    },
    dest: {
      value: dest, label: t.search.dest_label, placeholder: t.search.dest_placeholder,
      suggestions: destSuggestions,
      onChange: (v: string) => { setDest(v); searchAirports(v, setDestSuggestions) },
      onSelect: (a: any) => { setDest(a.code); setDestSuggestions([]) },
      onClear: () => { setDest(''); setDestSuggestions([]) },
    },
  }

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

          {isMobile ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <AirportInput {...airportInputProps.origin} />
                  <AirportInput {...airportInputProps.dest} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.search.filter_date}</p>
                    <div style={LIGHT_OVERRIDE}><DatePicker value={date} onChange={v => setDate(v)} min={new Date().toISOString().slice(0,10)} /></div>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.search.filter_sort}</p>
                    <div style={LIGHT_OVERRIDE}><Select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: '100%' }}>
                      <option value="">{t.search.sort_date}</option>
                      <option value="price_asc">{t.search.sort_price_asc}</option>
                      <option value="price_desc">{t.search.sort_price_desc}</option>
                    </Select></div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={handleSearch}
                  style={{background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(8px)',WebkitBackdropFilter: 'blur(8px)', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap'}}>
                  <Search size={15} color="#fff" />
                  {t.search.search_btn}
                </button>
              </div>
            </>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1.5fr) minmax(0, 1.2fr) minmax(0, 1.2fr) auto', 
              gap: 12, 
              alignItems: 'flex-end',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <AirportInput {...airportInputProps.origin} />
              <AirportInput {...airportInputProps.dest} />
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.search.filter_date}</p>
                <div style={LIGHT_OVERRIDE}><DatePicker value={date} onChange={v => setDate(v)} min={new Date().toISOString().slice(0,10)} /></div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.search.filter_sort}</p>
                <div style={LIGHT_OVERRIDE}><Select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: '100%' }}>
                  <option value="">{t.search.sort_date}</option>
                  <option value="price_asc">{t.search.sort_price_asc}</option>
                  <option value="price_desc">{t.search.sort_price_desc}</option>
                </Select></div>
              </div>
              <button onClick={handleSearch}
                style={{background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(8px)',WebkitBackdropFilter: 'blur(8px)', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap'}}>
                <Search size={15} color="#fff" />
                {t.search.search_btn}
              </button>
            </div>
          )}
        </div>
      </HeroHeader>

      {/* Résultats */}
      <div style={{ padding: '20px 20px 80px' }}>
        {searched && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setShowOwnTrips(v => !v)} style={{ fontSize: 11, color: showOwnTrips ? RED : TAUPE, background: 'transparent', border: '1px solid ' + (showOwnTrips ? RED : BORDER), borderRadius: 99, padding: '4px 12px', cursor: 'pointer', fontWeight: 600 }}>
              {showOwnTrips ? t.search.hide_own_trips ?? 'Masquer mes trajets' : t.search.show_own_trips ?? 'Inclure mes trajets'}
            </button>
            <button onClick={() => setShowUrgentOnly(v => !v)} style={{ fontSize: 11, color: showUrgentOnly ? '#92400E' : TAUPE, background: showUrgentOnly ? '#FFF3CD' : 'transparent', border: '1px solid ' + (showUrgentOnly ? '#FFE082' : BORDER), borderRadius: 99, padding: '4px 12px', cursor: 'pointer', fontWeight: 600 }}>
              ⚡ {showUrgentOnly ? (t.search.filter_urgent_active ?? 'Urgents uniquement') : (t.search.filter_urgent ?? 'Accepte urgents')}
            </button>
          </div>
        )}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 140, background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER }} />
            ))}
          </div>
        ) : searched && trips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: SAND, marginBottom: 16 }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M6 20L14 12L18 16L24 8L30 14" stroke="#B5AFAB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M4 26H10L14 18L19 22L23 14L28 20H32" stroke="#B5AFAB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.search.no_results}</p>
            <p style={{ color: TAUPE, fontSize: 13 }}>{t.search.no_results_sub}</p>
          </div>
        ) : trips.length > 0 ? (
          <>
          {(() => {
              const filtered = trips.filter((trip: any) => (showOwnTrips || String(trip.carrier_id) !== String(user?.id)) && (!showUrgentOnly || trip.accepts_urgent))
              return <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{filtered.length} {filtered.length > 1 ? t.search.results_count_plural : t.search.results_count}</p>
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {trips.filter((trip: any) => (showOwnTrips || String(trip.carrier_id) !== String(user?.id)) && (!showUrgentOnly || trip.accepts_urgent)).map((trip: any) => (
                <TripCard key={trip.id} trip={trip} onClick={() => handleTripClick(trip)} />
              ))}
            </div>
          </>
        ) : searched ? null : (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: SAND, marginBottom: 16 }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
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