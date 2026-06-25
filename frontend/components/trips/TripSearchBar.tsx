'use client'
import { Search } from 'lucide-react'
import AirportInput from '@/components/trips/AirportInput'
import DatePicker from '@/components/ui/kipar/DatePicker'
import Select from '@/components/ui/kipar/Select'
import type { TripSearchState } from '@/components/trips/useTripSearch'

const LIGHT_OVERRIDE: React.CSSProperties = { '--k-bg': '#ffffff', '--k-white': '#ffffff', '--k-charcoal': '#1A1A1A', '--k-border': 'rgba(255,255,255,0.4)' } as React.CSSProperties

export default function TripSearchBar({ search, t, isMobile }: {
  search: TripSearchState
  t: any
  isMobile: boolean
}) {
  const { originProps, destProps, date, setDate, sortBy, setSortBy, handleSearch } = search

  const originFull = { ...originProps, label: t.search.origin_label, placeholder: t.search.origin_placeholder }
  const destFull = { ...destProps, label: t.search.dest_label, placeholder: t.search.dest_placeholder }

  const searchBtn = (
    <button onClick={handleSearch}
      style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
      <Search size={15} color="#fff" />
      {t.search.search_btn}
    </button>
  )

  const dateSort = (
    <>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.search.filter_date}</p>
        <div style={LIGHT_OVERRIDE}><DatePicker value={date} onChange={v => setDate(v)} min={new Date().toISOString().slice(0, 10)} /></div>
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.search.filter_sort}</p>
        <div style={LIGHT_OVERRIDE}><Select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: '100%' }}>
          <option value="">{t.search.sort_date}</option>
          <option value="price_asc">{t.search.sort_price_asc}</option>
          <option value="price_desc">{t.search.sort_price_desc}</option>
        </Select></div>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AirportInput {...originFull} />
            <AirportInput {...destFull} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{dateSort}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>{searchBtn}</div>
      </>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1.5fr) minmax(0, 1.2fr) minmax(0, 1.2fr) auto', gap: 12, alignItems: 'flex-end', width: '100%', boxSizing: 'border-box' }}>
      <AirportInput {...originFull} />
      <AirportInput {...destFull} />
      {dateSort}
      {searchBtn}
    </div>
  )
}