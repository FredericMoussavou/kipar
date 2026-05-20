'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Zap, Shield, TrendingUp, Bell, Camera, Star, Crown, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import { Button } from '@/components/ui/kipar'
import HeroBackHeader from '@/components/layout/HeroBackHeader'
import api from '@/lib/api'
import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE } from '@/lib/theme'

const GOLD = '#F59E0B'
const GOLD_LIGHT = '#FEF3C7'
const GOLD_DARK = '#B45309'

interface PremiumStatus {
  is_premium: boolean
  plan: string | null
  expires_at: string | null
}

const FEATURES = [
  { icon: <Zap size={18} color={GOLD} />, label: 'Réservations illimitées', sub: '3 max en gratuit', premium: true },
  { icon: <Shield size={18} color={GOLD} />, label: 'Trajets illimités', sub: '2 max en gratuit', premium: true },
  { icon: <Star size={18} color={GOLD} />, label: 'Annonces illimitées', sub: '2 max en gratuit', premium: true },
  { icon: <Camera size={18} color={GOLD} />, label: '5 photos par colis', sub: '2 photos en gratuit', premium: true },
  { icon: <Zap size={18} color={GOLD} />, label: 'KiparScan illimité', sub: '3 scans/mois en gratuit', premium: true },
  { icon: <TrendingUp size={18} color={GOLD} />, label: 'Suivi vol en direct', sub: 'Non disponible en gratuit', premium: true },
  { icon: <Bell size={18} color={GOLD} />, label: 'Rappel avant atterrissage', sub: 'Non disponible en gratuit', premium: true },
  { icon: <TrendingUp size={18} color={GOLD} />, label: 'Export finance & fiscal', sub: 'Non disponible en gratuit', premium: true },
  { icon: <Crown size={18} color={GOLD} />, label: 'Badge Premium & mise en avant', sub: 'Non disponible en gratuit', premium: true },
  { icon: <Star size={18} color={GOLD} />, label: 'Historique avis complet', sub: '5 derniers en gratuit', premium: true },
  { icon: <Shield size={18} color={GOLD} />, label: 'Support prioritaire (SLA 4h)', sub: 'Support standard en gratuit', premium: true },
]

export default function PremiumPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const router = useRouter()
  const [status, setStatus] = useState<PremiumStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual')

  useEffect(() => {
    api.get('/premium/status').then(r => setStatus(r.data)).finally(() => setLoading(false))
  }, [])

  const handleSubscribe = async (rail: 'stripe' | 'cinetpay') => {
    if (rail === 'cinetpay') return // TODO: CinetPay integration
    setSubscribing(true)
    try {
      const res = await api.post('/premium/create-checkout-session', {
        plan: selectedPlan,
      })
      window.location.href = res.data.url
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur lors de la souscription')
    } finally {
      setSubscribing(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Annuler le renouvellement automatique ? Vous gardez l\'accès jusqu\'à expiration.')) return
    try {
      await api.post('/premium/cancel')
      alert('Renouvellement annulé.')
      router.refresh()
    } catch {
      alert('Erreur')
    }
  }

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div style={{ background: SAND, minHeight: '100vh', paddingBottom: 100 }}>

      <HeroBackHeader
        imageUrl="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80"
        title="KIPAR Premium"
        subtitle="Transportez sans limites"
        minHeight={160}
        gradient="vertical"
      />

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 20px' }}>

        {/* Statut actuel */}
        {!loading && status?.is_premium && (
          <div style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Crown size={20} color={GOLD_DARK} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: GOLD_DARK, margin: 0 }}>Abonnement Premium actif</p>
                <p style={{ fontSize: 11, color: GOLD_DARK, margin: '2px 0 0', opacity: 0.8 }}>
                  Plan {status.plan === 'annual' ? 'annuel' : 'mensuel'} · Expire le {status.expires_at ? fmtDate(status.expires_at) : '—'}
                </p>
              </div>
            </div>
            <button onClick={handleCancel} style={{ fontSize: 11, color: GOLD_DARK, background: 'transparent', border: `1px solid ${GOLD_DARK}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>
              Annuler le renouvellement
            </button>
          </div>
        )}

        {/* Sélecteur de plan */}
        {(!status?.is_premium) && (
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Choisir un plan</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {/* Mensuel */}
              <button type="button" onClick={() => setSelectedPlan('monthly')}
                style={{ padding: '16px', borderRadius: 12, border: `2px solid ${selectedPlan === 'monthly' ? GOLD : BORDER}`, background: selectedPlan === 'monthly' ? GOLD_LIGHT : WHITE, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: selectedPlan === 'monthly' ? GOLD_DARK : TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Mensuel</p>
                <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 24, fontWeight: 900, color: selectedPlan === 'monthly' ? GOLD_DARK : CHARCOAL, margin: '0 0 2px' }}>9,99€</p>
                <p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>par mois</p>
              </button>
              {/* Annuel */}
              <button type="button" onClick={() => setSelectedPlan('annual')}
                style={{ padding: '16px', borderRadius: 12, border: `2px solid ${selectedPlan === 'annual' ? GOLD : BORDER}`, background: selectedPlan === 'annual' ? GOLD_LIGHT : WHITE, cursor: 'pointer', textAlign: 'left', position: 'relative', transition: 'all 0.15s', overflow: 'visible', minWidth: 0 }}>
                <div style={{ position: 'absolute', top: -10, right: 10, background: RED, color: WHITE, fontSize: 9, fontWeight: 800, borderRadius: 99, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>-33%</div>
                <p style={{ fontSize: 11, fontWeight: 700, color: selectedPlan === 'annual' ? GOLD_DARK : TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Annuel</p>
                <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 900, color: selectedPlan === 'annual' ? GOLD_DARK : CHARCOAL, margin: '0 0 2px' }}>79,99€</p>
                <p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>par an · soit 6,67€/mois</p>
              </button>
            </div>

            {/* Boutons paiement */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" onClick={() => handleSubscribe('stripe')} disabled={subscribing}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: CHARCOAL, color: WHITE, fontSize: 14, fontWeight: 700, cursor: subscribing ? 'not-allowed' : 'pointer', opacity: subscribing ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#635BFF"/><path d="M13.5 12.5c0-1.1.9-1.5 2.3-1.5 2 0 4.6.6 6.2 1.7V8.4C20.4 7.5 18.4 7 16 7c-4.4 0-7.3 2.3-7.3 6 0 5.8 8 4.9 8 7.4 0 1.3-1.1 1.7-2.6 1.7-2.3 0-5.1-.9-7-2.3v4.5C8.8 25.5 11 26 13.4 26c4.5 0 7.6-2.2 7.6-6.1-.1-6.3-8-5.2-8-7.4z" fill="white"/></svg>
                Payer avec Stripe
              </button>
              <button type="button" onClick={() => handleSubscribe('cinetpay')} disabled={true}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${BORDER}`, background: WHITE, color: CHARCOAL, fontSize: 14, fontWeight: 600, cursor: 'not-allowed', opacity: 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="8" fill="#009A44"/><text x="6" y="27" fontSize="13" fontWeight="bold" fill="white">CP</text></svg>
                CinetPay (bientôt disponible)
              </button>
            </div>
            <p style={{ fontSize: 11, color: TAUPE, textAlign: 'center', margin: '12px 0 0' }}>
              Annulation à tout moment · Sans engagement
            </p>
          </div>
        )}

        {/* Liste des fonctionnalités */}
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '20px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Ce qui est inclus
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < FEATURES.length - 1 ? `1px solid ${SAND}` : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: GOLD_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL, margin: 0 }}>{f.label}</p>
                  <p style={{ fontSize: 11, color: TAUPE, margin: '2px 0 0' }}>{f.sub}</p>
                </div>
                <Check size={16} color="#16A34A" />
              </div>
            ))}
          </div>
        </div>

        {/* Note légale */}
        <p style={{ fontSize: 11, color: TAUPE, textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
          En souscrivant, vous acceptez nos <a href="/cgu" style={{ color: RED, textDecoration: 'none' }}>CGU</a> et notre <a href="/privacy" style={{ color: RED, textDecoration: 'none' }}>politique de confidentialité</a>.
          Le renouvellement automatique peut être annulé à tout moment depuis votre profil.
        </p>
      </div>
    </div>
  )
}