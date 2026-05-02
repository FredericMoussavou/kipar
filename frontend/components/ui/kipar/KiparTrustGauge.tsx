'use client'

import { getTrustGradient, normalizeTrustScore } from '@/lib/trust'
import { CHARCOAL, TAUPE, SAND } from '@/lib/theme'

type Size = 'sm' | 'md' | 'lg'
type Variant = 'bar' | 'circular'

interface KiparTrustGaugeProps {
  score: number | null | undefined
  size?: Size
  variant?: Variant
  showLabel?: boolean
}

const SIZE_CONFIG: Record<Size, {
  diameter: number
  stroke: number
  fontSize: number
  labelSize: number
  barHeight: number
}> = {
  sm: { diameter: 60, stroke: 6, fontSize: 16, labelSize: 9, barHeight: 4 },
  md: { diameter: 100, stroke: 8, fontSize: 26, labelSize: 11, barHeight: 6 },
  lg: { diameter: 160, stroke: 12, fontSize: 42, labelSize: 13, barHeight: 8 },
}

/**
 * Affiche le score KiparTrust avec un gradient rouge → orange → vert selon la valeur.
 *
 * @param score - Score 0-100 (null/undefined → 50 = base à la création)
 * @param size - Taille du composant : sm | md | lg (défaut: md)
 * @param variant - Forme : 'bar' (horizontale) ou 'circular' (gauge SVG, défaut)
 * @param showLabel - Afficher le label "KiparTrust" sous la valeur (défaut: true)
 */
export default function KiparTrustGauge({
  score,
  size = 'md',
  variant = 'circular',
  showLabel = true,
}: KiparTrustGaugeProps) {
  const normalized = normalizeTrustScore(score)
  const { gradient, color } = getTrustGradient(normalized)
  const config = SIZE_CONFIG[size]

  if (variant === 'bar') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        {showLabel && (
          <span style={{ fontSize: config.labelSize, color: TAUPE, minWidth: 60 }}>
            KiparTrust
          </span>
        )}
        <div style={{
          flex: 1,
          height: config.barHeight,
          background: SAND,
          borderRadius: 99,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${normalized}%`,
            height: '100%',
            background: gradient,
            borderRadius: 99,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{
          fontSize: config.fontSize / 1.6,
          fontWeight: 700,
          color,
          minWidth: 28,
          textAlign: 'right',
        }}>
          {normalized}
        </span>
      </div>
    )
  }

  // Variant 'circular' — gauge SVG
  const radius = (config.diameter - config.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - normalized / 100)
  const gradientId = `kipar-trust-gradient-${size}`

  // Stops du dégradé selon le palier (cohérent avec getTrustGradient)
  const gradientStops = (() => {
    if (normalized >= 75) return [
      { offset: '0%', color: '#F59E0B' },
      { offset: '60%', color: '#4ADE80' },
      { offset: '100%', color: '#16A34A' },
    ]
    if (normalized >= 50) return [
      { offset: '0%', color: '#F59E0B' },
      { offset: '100%', color: '#4ADE80' },
    ]
    if (normalized >= 30) return [
      { offset: '0%', color: '#DC0029' },
      { offset: '100%', color: '#F59E0B' },
    ]
    return [
      { offset: '0%', color: '#DC0029' },
      { offset: '100%', color: '#F97316' },
    ]
  })()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
    }}>
      <div style={{
        position: 'relative',
        width: config.diameter,
        height: config.diameter,
      }}>
        <svg
          width={config.diameter}
          height={config.diameter}
          style={{ transform: 'rotate(-90deg)' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              {gradientStops.map((stop, i) => (
                <stop key={i} offset={stop.offset} stopColor={stop.color} />
              ))}
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke={SAND}
            strokeWidth={config.stroke}
          />
          {/* Fill */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={config.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        {/* Score au centre */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-syne, Syne)',
            fontSize: config.fontSize,
            fontWeight: 800,
            color,
            lineHeight: 1,
          }}>
            {normalized}
          </span>
          <span style={{
            fontSize: config.labelSize,
            color: TAUPE,
            marginTop: 2,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            / 100
          </span>
        </div>
      </div>
      {showLabel && (
        <span style={{
          fontFamily: 'var(--font-syne, Syne)',
          fontSize: config.labelSize + 2,
          fontWeight: 600,
          color: CHARCOAL,
          letterSpacing: '0.02em',
        }}>
          KiparTrust
        </span>
      )}
    </div>
  )
}