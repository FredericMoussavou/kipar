'use client'
import { useRef, useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { CHARCOAL, TAUPE, SAND, WHITE } from '@/lib/theme'

export interface AirportSuggestion {
  code: string
  city?: string
  [k: string]: any
}

export default function AirportInput({
  value,
  onChange,
  onSelect,
  suggestions,
  onClear,
  placeholder,
  label,
  light = false,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (a: AirportSuggestion) => void
  suggestions: AirportSuggestion[]
  onClear: () => void
  placeholder: string
  label: string
  light?: boolean
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
      <p style={{ fontSize: light ? 12 : 11, fontWeight: light ? 500 : 700, color: light ? CHARCOAL : '#fff', marginBottom: 6, textTransform: light ? 'none' : 'uppercase', letterSpacing: light ? 0 : '0.07em' }}>{label}</p>
      <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 8, background: light ? '#FFFFFF' : 'rgba(255,255,255,0.95)', border: light ? '1px solid #D8D2CA' : 'none', borderRadius: 10, padding: '10px 12px' }}>
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
          {suggestions.map((a: AirportSuggestion) => (
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
