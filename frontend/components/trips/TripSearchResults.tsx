'use client'
import { useState } from 'react'
import { Zap, Plane, Mail } from 'lucide-react'
import { CHARCOAL, TAUPE, SAND, BORDER, WHITE } from '@/lib/theme'
import type { TripSearchState } from '@/components/trips/useTripSearch'

export default function TripSearchResults({
  search,
  t,
  renderCard,
  onTripClick,
  showOwnTripsFilter = false,
  currentUserId,
}: {
  search: TripSearchState
  t: any
  renderCard: (trip: any, onClick: () => void) => React.ReactNode
  onTripClick: (trip: any) => void
  showOwnTripsFilter?: boolean
  currentUserId?: string
}) {
  const { trips, isLoading, searched, hasMore, handleLoadMore } = search

  const [showOwnTrips, setShowOwnTrips] = useState(false)
  const [showUrgentOnly, setShowUrgentOnly] = useState(false)
  const [showSmallOnly, setShowSmallOnly] = useState(false)

  const visibleTrips = trips.filter((trip: any) =>
    (!showOwnTripsFilter || showOwnTrips || String(trip.carrier_id) !== String(currentUserId)) &&
    (!showUrgentOnly || trip.accepts_urgent) &&
    (!showSmallOnly || trip.small_package_price != null)
  )

  return (
    <div style={{ padding: '20px 20px 80px' }}>
      {searched && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
          {showOwnTripsFilter && (
            <button onClick={() => setShowOwnTrips(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: showOwnTrips ? CHARCOAL : TAUPE, background: showOwnTrips ? SAND : 'transparent', border: '1px solid ' + BORDER, borderRadius: 99, padding: '6px 12px', cursor: 'pointer' }}>
              <Plane size={15} /><span className="hidden md:inline">{showOwnTrips ? t.search.hide_own_trips : t.search.show_own_trips}</span>
            </button>
          )}
          <button onClick={() => setShowUrgentOnly(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: showUrgentOnly ? CHARCOAL : TAUPE, background: showUrgentOnly ? SAND : 'transparent', border: '1px solid ' + BORDER, borderRadius: 99, padding: '6px 12px', cursor: 'pointer' }}>
            <Zap size={15} /><span className="hidden md:inline">{showUrgentOnly ? t.search.filter_urgent_active : t.search.filter_urgent}</span>
          </button>
          <button onClick={() => setShowSmallOnly(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: showSmallOnly ? CHARCOAL : TAUPE, background: showSmallOnly ? SAND : 'transparent', border: '1px solid ' + BORDER, borderRadius: 99, padding: '6px 12px', cursor: 'pointer' }}>
            <Mail size={15} /><span className="hidden md:inline">{t.search.filter_small_packages}</span>
          </button>
        </div>
      )}

      {isLoading && trips.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 140, background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER }} />
          ))}
        </div>
      ) : searched && visibleTrips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: SAND, marginBottom: 16 }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M6 20L14 12L18 16L24 8L30 14" stroke="#B5AFAB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M4 26H10L14 18L19 22L23 14L28 20H32" stroke="#B5AFAB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.search.no_results}</p>
          <p style={{ color: TAUPE, fontSize: 13 }}>{t.search.no_results_sub}</p>
        </div>
      ) : visibleTrips.length > 0 ? (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            {visibleTrips.length} {visibleTrips.length > 1 ? t.search.results_count_plural : t.search.results_count}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibleTrips.map((trip: any) => renderCard(trip, () => onTripClick(trip)))}
          </div>
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <button onClick={handleLoadMore} disabled={isLoading}
                style={{ background: SAND, border: '1px solid ' + BORDER, borderRadius: 99, padding: '10px 28px', fontSize: 13, fontWeight: 700, color: CHARCOAL, cursor: isLoading ? 'default' : 'pointer', opacity: isLoading ? 0.6 : 1 }}>
                {isLoading ? t.search.loading_more : t.search.load_more}
              </button>
            </div>
          )}
        </>
      ) : !searched ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: SAND, marginBottom: 16 }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <circle cx="16" cy="16" r="9" stroke="#B5AFAB" strokeWidth="2.5" fill="none" />
              <line x1="22.5" y1="22.5" x2="30" y2="30" stroke="#B5AFAB" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.search.empty_title}</p>
          <p style={{ color: TAUPE, fontSize: 13 }}>{t.search.empty_subtitle}</p>
        </div>
      ) : null}
    </div>
  )
}