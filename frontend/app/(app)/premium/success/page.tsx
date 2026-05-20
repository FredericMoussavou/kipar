'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/kipar'
import { RED, CHARCOAL, SAND, WHITE, BORDER } from '@/lib/theme'

const GOLD = '#F59E0B'
const GOLD_LIGHT = '#FEF3C7'
const GOLD_DARK = '#B45309'

export default function PremiumSuccessPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer)
          router.push('/dashboard')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [router])

  return (
    <div style={{ background: SAND, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '40px 32px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: GOLD_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Crown size={36} color={GOLD_DARK} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 24, fontWeight: 900, color: CHARCOAL, margin: '0 0 8px' }}>
          Bienvenue dans Premium !
        </h1>
        <p style={{ fontSize: 14, color: GOLD_DARK, fontWeight: 600, margin: '0 0 24px' }}>
          Votre abonnement est actif
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, textAlign: 'left' }}>
          {['Réservations illimitées', 'Trajets illimités', 'KiparScan illimité', 'Badge Premium activé'].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={16} color='#16A34A' />
              <span style={{ fontSize: 13, color: CHARCOAL }}>{f}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 20px' }}>
          Redirection dans {countdown} seconde{countdown > 1 ? 's' : ''}...
        </p>
        <Button variant="primary" onClick={() => router.push('/dashboard')} style={{ width: '100%' }}>
          Aller au tableau de bord
        </Button>
      </div>
    </div>
  )
}
