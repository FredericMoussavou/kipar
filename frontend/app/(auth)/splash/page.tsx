'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const R = '#DC0029'
const CHARCOAL = '#1A1A1A'
const WHITE = '#FFFFFF'

function AnimatedDot() {
  const colors = ['#DC0029', '#F97316', '#FBBF24', '#DC0029']
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % colors.length), 800)
    return () => clearInterval(t)
  }, [])
  return <span style={{ color: colors[idx], transition: 'color 0.4s ease', display: 'inline-block' }}>.</span>
}

export default function SplashPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 100)
    const t2 = setTimeout(() => setPhase('exit'), 2200)
    const t3 = setTimeout(() => router.replace('/login'), 2800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${CHARCOAL} 0%, #2d0a12 55%, #1a0008 100%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      opacity: phase === 'exit' ? 0 : 1,
      transition: phase === 'exit' ? 'opacity 0.6s ease' : 'none',
    }}>
      {/* Cercles décoratifs */}
      <div style={{ position: 'absolute', top: -200, right: -200, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,0,41,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -150, left: -150, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,0,41,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Logo */}
      <div style={{
        opacity: phase === 'enter' ? 0 : 1,
        transform: phase === 'enter' ? 'scale(0.85) translateY(16px)' : 'scale(1) translateY(0)',
        transition: 'opacity 0.7s cubic-bezier(0.34,1.56,0.64,1), transform 0.7s cubic-bezier(0.34,1.56,0.64,1)',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-syne,Syne)',
          fontSize: 80, fontWeight: 900,
          color: WHITE, letterSpacing: '-0.04em',
          margin: 0, lineHeight: 1,
        }}>
          KIPAR<AnimatedDot />
        </h1>

        {/* Barre de chargement */}
        <div style={{ marginTop: 40, width: 120, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden', margin: '32px auto 0' }}>
          <div style={{
            height: '100%', background: R, borderRadius: 99,
            animation: 'loadBar 2s ease forwards',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes loadBar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}
