'use client'
import { ReactNode } from 'react'
import { Menu } from 'lucide-react'

interface HeroHeaderProps {
  imageUrl: string
  children: ReactNode
  minHeight?: number
  gradient?: 'vertical' | 'horizontal'
  onMenuOpen?: () => void
}

export default function HeroHeader({ imageUrl, children, minHeight = 180, gradient = 'horizontal', onMenuOpen }: HeroHeaderProps) {
  const bg = gradient === 'horizontal'
    ? 'linear-gradient(90deg, rgba(220,0,41,0.92) 0%, rgba(60,0,15,0.70) 100%)'
    : 'linear-gradient(180deg, rgba(220,0,41,0.92) 0%, rgba(60,0,15,0.80) 100%)'
  return (
    <div
      style={{ position: 'relative', overflow: 'visible', minHeight, borderRadius: '0 0 24px 24px' }}
      className="md:rounded-[20px] md:mb-6"
    >
      <img
        src={imageUrl}
        alt="hero"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: bg, borderRadius: 'inherit', overflow: 'hidden' }} />
      <div style={{
        position: 'relative', zIndex: 50,
        '--k-bg': '#ffffff',
        '--k-white': '#ffffff',
        '--k-charcoal': '#3D3D3D',
        '--k-charcoal-2': '#6B6560',
        '--k-taupe': '#B5AFAB',
        '--k-sand': '#F0EDE8',
        '--k-border': '#EEEBE6',
      } as React.CSSProperties}>
        {onMenuOpen && (
          <button
            onClick={onMenuOpen}
            className="md:hidden"
            style={{
              position: 'absolute', top: 16, left: 16, zIndex: 60,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Menu"
          >
            <Menu size={20} color="#fff" />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
