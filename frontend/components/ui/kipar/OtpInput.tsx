'use client'

import { useRef, KeyboardEvent, ClipboardEvent } from 'react'
import { CHARCOAL, TAUPE, BORDER, RED, WHITE } from '@/lib/theme'

interface OtpInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

export default function OtpInput({ length = 6, value, onChange, error, disabled }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const focus = (i: number) => {
    refs.current[Math.max(0, Math.min(length - 1, i))]?.focus()
  }

  const handleChange = (i: number, char: string) => {
    const d = char.replace(/\D/g, '').slice(-1)
    if (!d) return
    const next = digits.map((v, idx) => (idx === i ? d : v))
    onChange(next.join(''))
    if (i < length - 1) focus(i + 1)
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i] && digits[i] !== ' ') {
        const next = digits.map((v, idx) => (idx === i ? '' : v))
        onChange(next.join(''))
      } else if (i > 0) {
        const next = digits.map((v, idx) => (idx === i - 1 ? '' : v))
        onChange(next.join(''))
        focus(i - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focus(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focus(i + 1)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    onChange(pasted)
    focus(Math.min(pasted.length, length - 1))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={el => { refs.current[i] = el }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digits[i] ?? ''}
            disabled={disabled}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={e => e.target.select()}
            style={{
              width: 48,
              height: 56,
              textAlign: 'center',
              fontSize: 22,
              fontWeight: 700,
              fontFamily: 'var(--font-syne,Syne)',
              color: CHARCOAL,
              background: WHITE,
              border: '2px solid ' + (error ? RED : BORDER),
              borderRadius: 10,
              outline: 'none',
              transition: 'border-color 0.15s',
              caretColor: 'transparent',
              opacity: disabled ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!error) (e.target as HTMLInputElement).style.borderColor = TAUPE }}
            onMouseLeave={e => { if (!error) (e.target as HTMLInputElement).style.borderColor = BORDER }}
          />
        ))}
      </div>
      {error && (
        <p style={{ textAlign: 'center', color: RED, fontSize: 12, marginTop: 8 }}>{error}</p>
      )}
    </div>
  )
}
