'use client'
import { useState, useRef, useEffect, Children, isValidElement } from 'react'
import { ChevronDown } from 'lucide-react'
import { CHARCOAL, TAUPE, SAND, BORDER, RED, BG, WHITE } from '@/lib/theme'

interface SelectOption { value: string; label: string }

interface SelectProps {
  label?: string
  value: string
  onChange: (e: { target: { value: string } }) => void
  options?: SelectOption[]
  children?: React.ReactNode
  error?: string
  style?: React.CSSProperties
}

function parseChildren(children: React.ReactNode): SelectOption[] {
  const opts: SelectOption[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const el = child as React.ReactElement<any>
    if (el.type === 'option') {
      opts.push({ value: el.props.value ?? '', label: el.props.children ?? el.props.value })
    }
  })
  return opts
}

export default function Select({ label, value, onChange, options, children, error, style }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const opts = options ?? parseChildren(children)
  const selected = opts.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (val: string) => { onChange({ target: { value: val } }); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && <label style={{ fontSize: 12, fontWeight: 500, color: CHARCOAL }}>{label}</label>}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: BG, border: `1px solid ${error ? '#F87171' : open ? RED : BORDER}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'border-color 0.2s', userSelect: 'none' }}>
        <span style={{ flex: 1, fontSize: 13, color: selected ? CHARCOAL : TAUPE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? '—'}
        </span>
        <ChevronDown size={14} color={TAUPE} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }} />
      </div>
      {error && <p style={{ fontSize: 11, color: '#F87171', margin: 0 }}>{error}</p>}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto' }}>
          {opts.map(opt => (
            <div key={opt.value} onClick={() => pick(opt.value)}
              style={{ padding: '10px 14px', fontSize: 13, color: opt.value === value ? RED : CHARCOAL, fontWeight: opt.value === value ? 600 : 400, background: opt.value === value ? 'rgba(220,0,41,0.05)' : 'transparent', cursor: 'pointer', borderBottom: `1px solid ${SAND}` }}
              onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLDivElement).style.background = SAND }}
              onMouseLeave={e => { if (opt.value !== value) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
