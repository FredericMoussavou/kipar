import { InputHTMLAttributes, forwardRef, ReactNode } from 'react'
import { CHARCOAL, TAUPE, SAND, BORDER, RED, BG } from '@/lib/theme'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, leftIcon, rightIcon, style, ...props
}, ref) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 500, color: CHARCOAL }}>{label}</label>
      )}
      <div style={{ position: 'relative' }}>
        {leftIcon && (
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: TAUPE, display: 'flex' }}>
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          style={{
            width: '100%',
            background: BG,
            border: '1px solid ' + (error ? '#F87171' : BORDER),
            borderRadius: 10,
            padding: leftIcon ? '10px 12px 10px 36px' : '10px 12px',
            fontSize: 13,
            color: CHARCOAL,
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
            ...style,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = RED }}
          onBlur={e => { e.currentTarget.style.borderColor = error ? '#F87171' : BORDER }}
          {...props}
        />
        {rightIcon && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: TAUPE, display: 'flex' }}>
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p style={{ fontSize: 11, color: RED }}>{error}</p>}
    </div>
  )
})

Input.displayName = 'Input'
export default Input