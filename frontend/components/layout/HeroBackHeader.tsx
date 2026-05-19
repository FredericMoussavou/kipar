'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ReactNode } from 'react'

interface HeroBackHeaderProps {
  imageUrl: string
  title: string
  subtitle?: string
  minHeight?: number
  gradient?: 'vertical' | 'horizontal'
  onBack?: () => void
  rightSlot?: ReactNode
}

export default function HeroBackHeader({
  imageUrl,
  title,
  subtitle,
  minHeight = 140,
  gradient = 'vertical',
  onBack,
  rightSlot,
}: HeroBackHeaderProps) {
  const router = useRouter()
  const bg = gradient === 'horizontal'
    ? 'linear-gradient(90deg, rgba(220,0,41,0.92) 0%, rgba(60,0,15,0.70) 100%)'
    : 'linear-gradient(180deg, rgba(220,0,41,0.92) 0%, rgba(60,0,15,0.80) 100%)'

  const handleBack = onBack ?? (() => router.back())

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight, borderRadius: '0 0 24px 24px' }}>
      <img
        src={imageUrl}
        alt="hero"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: bg }} />
      <div style={{
        position: 'relative', zIndex: 50,
        padding: '48px 16px 24px',
        display: 'grid',
        gridTemplateColumns: '44px 1fr 44px',
        alignItems: 'center',
        gap: 4,
        '--k-bg': '#ffffff',
        '--k-white': '#ffffff',
        '--k-charcoal': '#3D3D3D',
        '--k-charcoal-2': '#6B6560',
        '--k-taupe': '#B5AFAB',
        '--k-sand': '#F0EDE8',
        '--k-border': '#EEEBE6',
      } as React.CSSProperties}>
        {/* Colonne gauche — bouton retour */}
        <button
          onClick={handleBack}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} color="#fff" />
        </button>

        {/* Colonne centre — titre + sous-titre */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontFamily: 'var(--font-syne,Syne)',
            fontSize: 20, fontWeight: 800,
            color: '#fff', textAlign: 'center',
            margin: 0, lineHeight: 1.2,
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: '4px 0 0' }}>{subtitle}</p>
          )}
        </div>

        {/* Colonne droite — slot optionnel ou vide */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {rightSlot ?? null}
        </div>
      </div>
    </div>
  )
}