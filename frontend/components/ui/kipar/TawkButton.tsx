'use client'
import { Headphones } from 'lucide-react'
import { RED, WHITE, CHARCOAL } from '@/lib/theme'

export default function TawkButton() {
  const handleClick = () => {
    const api = (window as any).Tawk_API
    if (api?.toggle) api.toggle()
  }

  return (
    <button
      onClick={handleClick}
      className="hidden md:flex"
      style={{
        position: 'fixed',
        bottom: 10,
        right: 20,
        zIndex: 9998,
        background: RED,
        color: WHITE,
        border: 'none',
        borderRadius: 24,
        padding: '10px 16px',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
      aria-label="Support"
    >
      <Headphones size={16} />
      Support
    </button>
  )
}
