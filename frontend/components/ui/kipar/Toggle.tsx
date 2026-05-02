'use client'

import { RED, WHITE, TAUPE, SAND, BORDER } from '@/lib/theme'

type Size = 'sm' | 'md'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  size?: Size
  disabled?: boolean
  ariaLabel?: string
}

const SIZE_CONFIG: Record<Size, {
  width: number
  height: number
  thumbSize: number
  padding: number
}> = {
  sm: { width: 36, height: 20, thumbSize: 16, padding: 2 },
  md: { width: 44, height: 24, thumbSize: 20, padding: 2 },
}

/**
 * Switch on/off réutilisable.
 *
 * @example
 *   <Toggle checked={enabled} onChange={setEnabled} ariaLabel="Notifications email" />
 */
export default function Toggle({
  checked,
  onChange,
  size = 'md',
  disabled = false,
  ariaLabel,
}: ToggleProps) {
  const config = SIZE_CONFIG[size]
  const translateX = config.width - config.thumbSize - config.padding * 2

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onChange(!checked)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        width: config.width,
        height: config.height,
        borderRadius: config.height / 2,
        background: disabled
          ? SAND
          : checked
            ? RED
            : BORDER,
        border: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        outline: 'none',
      }}
      onFocus={(e) => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = `0 0 0 3px rgba(220,0,41,0.15)`
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: config.padding,
          left: config.padding,
          width: config.thumbSize,
          height: config.thumbSize,
          borderRadius: '50%',
          background: WHITE,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transform: `translateX(${checked ? translateX : 0}px)`,
          transition: 'transform 0.2s ease',
        }}
      />
    </button>
  )
}