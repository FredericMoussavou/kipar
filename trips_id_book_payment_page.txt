'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CreditCard, Smartphone, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from '@/hooks/useTranslation'
import { Button } from '@/components/ui/kipar'
import HeroHeader from '@/components/layout/HeroHeader'
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
  const { t } = useTranslation()
  const bookingId = searchParams.get('booking_id')
  const amount = searchParams.get('amount')
  const [selectedPM, setSelectedPM] = useState<'stripe' | 'flutterwave'>('stripe')
  const declaredValue = parseFloat(searchParams.get('declared_value') || '0') || 0
  const baseAmount = parseFloat(amount || '0') || 0
  const totalAmount = baseAmount.toFixed(2)

  const handleStripeSuccess = () => {
    toast.success(t.payment.success ?? 'Paiement confirmé !')
    router.push(`/packages/${bookingId}?success=true`)
  }

  const handleStripeError = (msg: string) => {
    toast.error(msg)
  }

  const flutterwaveMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/payments/${bookingId}/flutterwave`, { currency: 'XOF' })
      return data
    },
    onSuccess: (data) => {
      if (data.payment_link) {
        window.open(data.payment_link, '_blank')
        toast.info(t.payment.flutterwave_redirect ?? 'Redirection vers Mobile Money...')
        setTimeout(() => router.push(`/packages/${bookingId}`), 2000)
      }
    },
    onError: () => toast.error(t.errors.generic),
  })

  const paymentMethods = [
    { id: 'stripe' as const, icon: CreditCard, label: t.payment.card, desc: t.payment.card_desc },
    { id: 'flutterwave' as const, icon: Smartphone, label: t.payment.mobile_money, desc: t.payment.mobile_money_desc },
  ]

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80"
        minHeight={160}
        gradient="vertical"
      >
        <div style={{ padding: '48px 20px 24px', position: 'relative' }}>
          <button
            onClick={() => router.back()}
            style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} color="#fff" />
          </button>
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
            {t.payment.title}
          </h1>
          <p style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, marginTop: 8, fontFamily: 'var(--font-syne,Syne)', color: '#fff' }}>
            {totalAmount}€
          </p>
        </div>
      </HeroHeader>

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

        {/* Résumé montant */}
        <div style={{ background: SAND, borderRadius: 14, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: CHARCOAL2 }}>{t.payment.total}</span>
          <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, color: CHARCOAL }}>{totalAmount}€</span>
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
          <Button fullWidth size="lg" loading={flutterwaveMutation.isPending} onClick={() => flutterwaveMutation.mutate()}>
            <Smartphone size={15} />
            {t.payment.pay_mobile_money ?? 'Payer par Mobile Money'}
          </Button>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: TAUPE }}>
          🔒 {t.payment.secure}
        </p>
      </div>
    </div>
  )
}
