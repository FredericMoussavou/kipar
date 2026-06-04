'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CreditCard, Smartphone, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from '@/hooks/useTranslation'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { useAuthStore } from '@/stores/auth.store'
import { Button, CurrencyDisplay } from '@/components/ui/kipar'
import HeroHeader from '@/components/layout/HeroHeader'
import HeroBackHeader from '@/components/layout/HeroBackHeader'
import api from '@/lib/api'
import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, GREEN } from '@/lib/theme'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

// ── Formulaire carte Stripe ──────────────────────────────────────────────────
function StripeForm({ bookingId, onSuccess, onError }: {
  bookingId: string
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      try {
        await api.post(`/payments/${bookingId}/stripe`, {})
        await api.post(`/payments/${bookingId}/confirm`, {})
        onSuccess()
      } catch { onError('Erreur simulation') }
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post(`/payments/${bookingId}/stripe`, {})
      const clientSecret = data.client_secret
      if (clientSecret.startsWith('pi_simulated')) {
        // Mode sandbox
        await api.post(`/payments/${bookingId}/confirm`, {})
        onSuccess()
        return
      }
      const card = elements.getElement(CardElement)
      if (!card) return
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      })
      if (error) { onError(error.message ?? t.errors.generic); return }
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
        await api.post(`/payments/${bookingId}/confirm`, {})
        onSuccess()
      }
    } catch (err: any) {
      onError(err?.response?.data?.detail ?? t.errors.generic)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 12, padding: '14px 16px' }}>
        <CardElement options={{
          style: {
            base: {
              fontSize: '14px',
              color: '#3D3D3D',
              fontFamily: 'DM Sans, sans-serif',
              '::placeholder': { color: '#B5AFAB' },
            },
            invalid: { color: '#DC0029' },
          }
        }} />
      </div>
      <Button fullWidth size="lg" loading={loading} onClick={handleSubmit}>
        <Lock size={15} />
        {t.payment.pay_btn}
      </Button>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function PaymentPage() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const rates = useExchangeRates()
  const { t } = useTranslation()
  const bookingId = searchParams.get('booking_id')
  const amount = searchParams.get('amount')
  const currency = searchParams.get('currency') ?? 'EUR'
  const [selectedPM, setSelectedPM] = useState<'stripe' | 'pawapay'>('stripe')
  const declaredValue = parseFloat(searchParams.get('declared_value') || '0') || 0
  const baseAmount = parseFloat(amount || '0') || 0
  const transportAmount = parseFloat(searchParams.get('transport') || '0') || 0
  const feesAmount = transportAmount > 0 ? baseAmount - transportAmount : 0

  const handleStripeSuccess = () => {
    toast.success(t.payment.success ?? 'Paiement confirmé !')
    router.replace(`/packages/${bookingId}?success=true`)
  }

  const handleStripeError = (msg: string) => {
    toast.error(msg)
  }

  const [pawapayPhone, setPawapayPhone] = useState('')
  const [pawapayProvider, setPawapayProvider] = useState('ORANGE_SEN')
  const [pawapayWaiting, setPawapayWaiting] = useState(false)

  const pawapayMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/payments/${bookingId}/pawapay`, null, {
        params: { phone: pawapayPhone, provider: pawapayProvider, currency: 'XOF' }
      })
      return data
    },
    onSuccess: () => {
      setPawapayWaiting(true)
      toast.info(t.payment.pawapay_waiting ?? 'En attente de confirmation...')
      // Poll statut booking toutes les 3s pendant 2 min
      let attempts = 0
      const interval = setInterval(async () => {
        attempts++
        try {
          const { data } = await api.get(`/bookings/${bookingId}`)
          if (data.status === 'accepted' || data.status === 'paid') {
            clearInterval(interval)
            setPawapayWaiting(false)
            toast.success(t.payment.pawapay_success ?? 'Paiement confirmé !')
            router.replace(`/packages/${bookingId}?success=true`)
          }
        } catch {}
        if (attempts >= 40) {
          clearInterval(interval)
          setPawapayWaiting(false)
        }
      }, 3000)
    },
    onError: () => toast.error(t.payment.pawapay_failed ?? t.errors.generic),
  })

  const paymentMethods = [
    { id: 'stripe' as const, icon: CreditCard, label: t.payment.card, desc: t.payment.card_desc },
    { id: 'pawapay' as const, icon: Smartphone, label: t.payment.mobile_money, desc: t.payment.mobile_money_desc },
  ]

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      <HeroBackHeader
        imageUrl="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80"
        title={t.payment.title}
        minHeight={160}
        gradient="vertical"
      />

      <div style={{ padding: '24px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}
        className="md:max-w-2xl md:mx-auto">

        {/* Sélection moyen de paiement */}
        {paymentMethods.map(({ id: pmId, icon: Icon, label, desc }) => (
          <div key={pmId} onClick={() => setSelectedPM(pmId)}
            style={{ background: WHITE, border: `2px solid ${selectedPM === pmId ? RED : BORDER}`, borderRadius: 16, padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: selectedPM === pmId ? '#FFF0F2' : SAND, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} color={selectedPM === pmId ? RED : CHARCOAL2} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>{label}</p>
              <p style={{ fontSize: 12, color: TAUPE, marginTop: 2 }}>{desc}</p>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selectedPM === pmId ? RED : BORDER}`, background: selectedPM === pmId ? RED : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {selectedPM === pmId && <div style={{ width: 7, height: 7, borderRadius: '50%', background: WHITE }} />}
            </div>
          </div>
        ))}

        {/* Récapitulatif */}
        <div style={{ background: SAND, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>{t.booking.subtitle ?? 'Détail'}</p>
          {transportAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: CHARCOAL2 }}>
              <span>{t.booking.transport_cost}</span>
              <span><CurrencyDisplay amount={transportAmount} currency={currency} userCurrency={user?.currency} rates={rates ?? undefined} exact /></span>
            </div>
          )}
          {feesAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: CHARCOAL2 }}>
              <span>{t.booking.commission}</span>
              <span><CurrencyDisplay amount={feesAmount} currency={currency} userCurrency={user?.currency} rates={rates ?? undefined} exact /></span>
            </div>
          )}
          <div style={{ borderTop: '1px solid ' + BORDER, paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: CHARCOAL }}>
            <span>{t.payment.total}</span>
            <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, color: CHARCOAL }}><CurrencyDisplay amount={baseAmount} currency={currency} userCurrency={user?.currency} rates={rates ?? undefined} exact /></span>
          </div>
        </div>

        {/* Politique annulation */}
        <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>{t.payment.cancel_policy_title}</p>
          <p style={{ fontSize: 11, color: '#92400E', marginBottom: 3 }}>✓ {t.payment.cancel_policy_full}</p>
          <p style={{ fontSize: 11, color: '#92400E', marginBottom: 3 }}>⚠ {t.payment.cancel_policy_partial}</p>
          <p style={{ fontSize: 11, color: '#92400E' }}>✗ {t.payment.cancel_policy_none}</p>
        </div>

        {/* Formulaire selon moyen de paiement */}
        {selectedPM === 'stripe' ? (
          <Elements stripe={stripePromise}>
            <StripeForm
              bookingId={bookingId ?? ''}
              onSuccess={handleStripeSuccess}
              onError={handleStripeError}
            />
          </Elements>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: CHARCOAL }}>
                {t.payment.pawapay_phone_label ?? 'Numéro Mobile Money'}
              </label>
              <input
                type="tel"
                value={pawapayPhone}
                onChange={e => setPawapayPhone(e.target.value)}
                placeholder={t.payment.pawapay_phone_placeholder ?? '+221 77 000 00 00'}
                style={{ border: '1px solid ' + BORDER, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: CHARCOAL, background: WHITE, outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: CHARCOAL }}>
                {t.payment.pawapay_provider_label ?? 'Opérateur'}
              </label>
              <select
                value={pawapayProvider}
                onChange={e => setPawapayProvider(e.target.value)}
                style={{ border: '1px solid ' + BORDER, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: CHARCOAL, background: WHITE, outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
              >
                <option value="ORANGE_SEN">Orange Senegal</option>
                <option value="FREE_SEN">Free Senegal</option>
                <option value="MTN_MOMO_CMR">MTN Cameroun</option>
                <option value="ORANGE_CMR">Orange Cameroun</option>
                <option value="MTN_MOMO_CIV">MTN Côte d'Ivoire</option>
                <option value="ORANGE_CIV">Orange Côte d'Ivoire</option>
                <option value="MTN_MOMO_GHA">MTN Ghana</option>
                <option value="VODAFONE_GHA">Vodafone Ghana</option>
                <option value="MTN_MOMO_UGA">MTN Uganda</option>
                <option value="AIRTEL_UGA">Airtel Uganda</option>
                <option value="MPESA_KEN">M-Pesa Kenya</option>
                <option value="MTN_MOMO_ZMB">MTN Zambia</option>
              </select>
            </div>
            {pawapayWaiting && (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#166534', margin: 0 }}>
                  📱 {t.payment.pawapay_waiting ?? 'En attente de confirmation sur votre téléphone...'}
                </p>
              </div>
            )}
            <Button fullWidth size="lg" loading={pawapayMutation.isPending || pawapayWaiting}
            onClick={() => pawapayMutation.mutate()}
            disabled={!pawapayPhone || pawapayWaiting}>
            <Smartphone size={15} />
            {pawapayWaiting ? (t.payment.pawapay_waiting ?? 'En attente...') : (t.payment.pay_pawapay ?? 'Payer par Mobile Money')}
          </Button>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: TAUPE }}>
          🔒 {t.payment.secure}
        </p>
      </div>
    </div>
  )
}
