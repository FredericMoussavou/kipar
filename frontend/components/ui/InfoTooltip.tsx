'use client'
import { useState } from 'react'
import { Info } from 'lucide-react'
import { TAUPE, SAND, WHITE, BORDER, CHARCOAL } from '@/lib/theme'

/**
 * Petite bulle d'info : icone (i) qui affiche un texte au survol (desktop)
 * et au clic (mobile/tactile).
 */
export default function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 6, verticalAlign: 'middle' }}>
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
        aria-label="Info"
        style={{ display: 'inline-flex', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: TAUPE }}
      >
        <Info size={14} />
      </button>
      {show && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 220,
            background: SAND,
            color: CHARCOAL,
            fontSize: 11,
            lineHeight: 1.4,
            fontWeight: 400,
            padding: '8px 10px',
            borderRadius: 8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
            border: `1px solid ${BORDER}`,
            zIndex: 90,
            textTransform: 'none',
            letterSpacing: 0,
            pointerEvents: 'none',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}