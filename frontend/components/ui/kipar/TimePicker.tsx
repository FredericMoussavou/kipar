'use client'
import { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { RED, CHARCOAL, TAUPE, SAND, BORDER, WHITE, BG } from '@/lib/theme'

interface TimePickerProps {
  label?: string
  value: string
  onChange: (val: string) => void
  error?: string
  required?: boolean
}

export default function TimePicker({ label, value, onChange, error, required }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [hh, mm] = value ? value.split(':') : ['', '']
  const [selH, setSelH] = useState(hh ? parseInt(hh) : -1)
  const [selM, setSelM] = useState(mm ? parseInt(mm) : -1)
  // Resync si `value` change de l'exterieur (ex: restauration de formulaire)
  useEffect(() => {
    const [h, m] = value ? value.split(':') : ['', '']
    setSelH(h ? parseInt(h) : -1)
    setSelM(m ? parseInt(m) : -1)
  }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (h: number, m: number) => {
    setSelH(h); setSelM(m)
    onChange(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
    setOpen(false)
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 60 }, (_, i) => i)

  const displayValue = selH >= 0 && selM >= 0
    ? `${String(selH).padStart(2,'0')}:${String(selM).padStart(2,'0')}`
    : ''

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 500, color: CHARCOAL }}>{label}{required && <span style={{ color: RED }}> *</span>}</label>}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: BG, border: `1px solid ${error ? '#F87171' : open ? RED : BORDER}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'border-color 0.2s' }}>
        <span style={{ flex: 1, fontSize: 13, color: displayValue ? CHARCOAL : TAUPE }}>
          {displayValue || '--:--'}
        </span>
        <Clock size={15} color={TAUPE} />
      </div>
      {error && <p style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{error}</p>}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 1000, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 240 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Heure</p>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {hours.map(h => (
                  <button key={h} type='button'
                    onClick={() => { setSelH(h); if (selM >= 0) pick(h, selM) }}
                    style={{ padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 13, background: selH === h ? RED : 'transparent', color: selH === h ? WHITE : CHARCOAL, fontWeight: selH === h ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { if (selH !== h) e.currentTarget.style.background = SAND }}
                    onMouseLeave={e => { if (selH !== h) e.currentTarget.style.background = 'transparent' }}>
                    {String(h).padStart(2,'0')}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: 1, background: SAND }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Min</p>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {minutes.map(m => (
                  <button key={m} type='button'
                    onClick={() => { setSelM(m); if (selH >= 0) pick(selH, m) }}
                    style={{ padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 13, background: selM === m ? RED : 'transparent', color: selM === m ? WHITE : CHARCOAL, fontWeight: selM === m ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { if (selM !== m) e.currentTarget.style.background = SAND }}
                    onMouseLeave={e => { if (selM !== m) e.currentTarget.style.background = 'transparent' }}>
                    {String(m).padStart(2,'0')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button type='button' onClick={() => { setSelH(-1); setSelM(-1); onChange(''); setOpen(false) }}
            style={{ marginTop: 8, width: '100%', padding: '6px', borderRadius: 6, border: 'none', fontSize: 11, color: TAUPE, background: 'none', cursor: 'pointer', borderTop: `1px solid ${SAND}`, paddingTop: 8 }}>
            Effacer
          </button>
        </div>
      )}
    </div>
  )
}