'use client'
import { TextareaHTMLAttributes, forwardRef } from 'react'
import { CHARCOAL, TAUPE, BORDER, RED, BG } from '@/lib/theme'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label, error, style, ...props
}, ref) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 500, color: CHARCOAL }}>{label}</label>
      )}
      <textarea
        ref={ref}
        style={{
          width: '100%',
          background: BG,
          border: '1px solid ' + (error ? '#F87171' : BORDER),
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 13,
          color: CHARCOAL,
          outline: 'none',
          resize: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s',
          ...style,
        }}
        onFocus={e => { e.currentTarget.style.borderColor = RED }}
        onBlur={e => { e.currentTarget.style.borderColor = error ? '#F87171' : BORDER }}
        {...props}
      />
      {error && <p style={{ fontSize: 11, color: RED }}>{error}</p>}
    </div>
  )
})

Textarea.displayName = 'Textarea'
export default Textarea
