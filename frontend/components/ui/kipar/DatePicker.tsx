'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { RED, CHARCOAL, TAUPE, SAND, BORDER, WHITE, BG } from '@/lib/theme'

interface DatePickerProps {
  label?: string
  value: string
  onChange: (val: string) => void
  error?: string
  min?: string
  max?: string
  locale?: string
}

export default function DatePicker({ label, value, onChange, error, min, max, locale = 'fr-FR' }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  
  // Normalisation d'aujourd'hui à minuit pile
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const parsed = value ? new Date(value) : null
  const [view, setView] = useState({ year: parsed?.getFullYear() ?? today.getFullYear(), month: parsed?.getMonth() ?? today.getMonth() })

  // Génération dynamique et localisée des mois et des jours
  const MONTHS = useMemo(() => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, i, 1)).replace(/^\w/, c => c.toUpperCase())), [locale])
  const DAYS = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, i + 1)).substring(0, 2).replace(/^\w/, c => c.toUpperCase())), [locale])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const firstDay = (new Date(view.year, view.month, 1).getDay() + 6) % 7

  // Helper pour supprimer l'heure et éviter les faux-positifs
  const getMidnightDate = (dStr?: string) => {
    if (!dStr) return null
    const d = new Date(dStr)
    d.setHours(0, 0, 0, 0)
    return d
  }
  
  const minDate = getMidnightDate(min)
  const maxDate = getMidnightDate(max)

  const selectDay = (d: number) => {
    const m = String(view.month + 1).padStart(2, '0')
    const day = String(d).padStart(2, '0')
    onChange(`${view.year}-${m}-${day}`)
    setOpen(false)
  }

  const isSelected = (d: number) => {
    if (!parsed) return false
    return parsed.getFullYear() === view.year && parsed.getMonth() === view.month && parsed.getDate() === d
  }

  const isDisabled = (d: number) => {
    const dt = new Date(view.year, view.month, d)
    dt.setHours(0, 0, 0, 0)
    if (minDate && dt < minDate) return true
    if (maxDate && dt > maxDate) return true
    return false
  }

  const isToday = (d: number) => today.getFullYear() === view.year && today.getMonth() === view.month && today.getDate() === d

  const prev = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  const next = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })

  const displayValue = parsed ? `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}` : ''

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 500, color: CHARCOAL }}>{label}</label>}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: BG, border: `1px solid ${error ? '#F87171' : open ? RED : BORDER}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'border-color 0.2s' }}>
        <span style={{ flex: 1, fontSize: 13, color: displayValue ? CHARCOAL : TAUPE }}>
          {displayValue || 'jj/mm/aaaa'}
        </span>
        <Calendar size={15} color={TAUPE} />
      </div>
      {error && <p style={{ fontSize: 11, color: '#F87171', margin: 0 }}>{error}</p>}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type='button' onClick={prev} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: TAUPE }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL }}>{MONTHS[view.month]} {view.year}</span>
            <button type='button' onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: TAUPE }}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: TAUPE, padding: '4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
              <button key={d} type='button' onClick={() => !isDisabled(d) && selectDay(d)}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: 6, border: 'none', fontSize: 12,
                  background: isSelected(d) ? RED : 'transparent',
                  color: isSelected(d) ? WHITE : isDisabled(d) ? TAUPE : isToday(d) ? RED : CHARCOAL,
                  fontWeight: isSelected(d) || isToday(d) ? 600 : 400,
                  cursor: isDisabled(d) ? 'not-allowed' : 'pointer',
                  opacity: isDisabled(d) ? 0.4 : 1,
                  outline: isToday(d) && !isSelected(d) ? `1.5px solid ${RED}` : 'none',
                }}
                onMouseEnter={e => { if (!isDisabled(d) && !isSelected(d)) e.currentTarget.style.background = SAND }}
                onMouseLeave={e => { if (!isSelected(d)) e.currentTarget.style.background = 'transparent' }}>
                {d}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, borderTop: `1px solid ${SAND}`, paddingTop: 8 }}>
            <button type='button' onClick={() => { onChange(''); setOpen(false) }}
              style={{ fontSize: 11, color: TAUPE, background: 'none', border: 'none', cursor: 'pointer' }}>Effacer</button>
            <button type='button' onClick={() => { const t = new Date(); setView({ year: t.getFullYear(), month: t.getMonth() }) }}
              style={{ fontSize: 11, color: RED, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Aujourd'hui</button>
          </div>
        </div>
      )}
    </div>
  )
}