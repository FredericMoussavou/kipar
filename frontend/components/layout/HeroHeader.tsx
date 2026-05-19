'use client'

import { ReactNode } from 'react'

interface HeroHeaderProps {
  imageUrl: string
  children: ReactNode
  minHeight?: number
  gradient?: 'vertical' | 'horizontal'
}

export default function HeroHeader({ imageUrl, children, minHeight = 180, gradient = 'horizontal' }: HeroHeaderProps) {
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
        {children}
      </div>
    </div>
  )
}