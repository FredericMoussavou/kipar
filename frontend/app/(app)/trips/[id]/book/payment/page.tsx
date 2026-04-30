'use client'

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CreditCard, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from '@/hooks/useTranslation'
import { Button } from '@/components/ui/kipar'
import api from '@/lib/api'

import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER } from '@/lib/theme'

export default function PaymentPage() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const bookingId = searchParams.get('booking_id')
  const amount = searchParams.get('amount')
  const [selectedPM, setSelectedPM] = useState<'stripe' | 'flutterwave'>('stripe')
  const [withInsurance, setWithInsurance] = useState(false)
  const declaredValue = parseFloat(searchParams.get('declared_value') || '0') || 0
  const baseAmount = parseFloat(amount || '0') || 0
  const insuranceAmount = withInsurance ? declaredValue * 0.03 : 0
  const totalAmount = (baseAmount + insuranceAmount).toFixed(2)

  const paymentMethods = [
    { id: 'stripe' as const, icon: CreditCard, label: t.payment.card, desc: t.payment.card_desc },
    { id: 'flutterwave' as const, icon: Smartphone, label: t.payment.mobile_money, desc: t.payment.mobile_money_desc },
  ]

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post(`/payments/${bookingId}/${selectedPM}`, {})
    },
    onSuccess: () => {
      router.push(`/packages/${bookingId}?success=true`)
    },
    onError: (err: any) => {
      // Paiement simulé — redirige quand même
      toast.info(t.payment.simulated)
      setTimeout(() => router.push(`/packages/${bookingId}`), 1200)
    },
  })

  return (
    <div style={{ background: '#FBFBFF', minHeight: '100vh' }}>

      <div style={{ background: RED, padding: '48px 20px 24px', color: '#fff', position: 'relative' }}>
        <button
          onClick={() => router.back()}
          style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} color="#fff" />
        </button>
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, textAlign: 'center' }}>
          {t.payment.title}
        </h1>
          <p style={{ textAlign: 'center', fontSize: 24, fontWeight: 800, marginTop: 8, fontFamily: 'var(--font-syne,Syne)' }}>
            {totalAmount}€
          </p>
      </div>

      <div style={{ padding: '24px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {paymentMethods.map(({ id: pmId, icon: Icon, label, desc }) => (
          <div
            key={pmId}
            onClick={() => setSelectedPM(pmId)}
            style={{ background: '#fff', border: `2px solid ${selectedPM === pmId ? RED : BORDER}`, borderRadius: 16, padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 14, background: selectedPM === pmId ? '#FFF0F2' : SAND, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} color={selectedPM === pmId ? RED : CHARCOAL2} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>{label}</p>
              <p style={{ fontSize: 12, color: TAUPE, marginTop: 2 }}>{desc}</p>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selectedPM === pmId ? RED : BORDER}`, background: selectedPM === pmId ? RED : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {selectedPM === pmId && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
            </div>
          </div>
        ))}

        <div style={{ background: SAND, borderRadius: 14, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: CHARCOAL2 }}>{t.payment.total}</span>
          <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, color: CHARCOAL }}>{totalAmount}€</span>
        </div>

        <Button fullWidth size="lg" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          {t.payment.pay_btn}
        </Button>

        <p style={{ textAlign: 'center', fontSize: 11, color: TAUPE }}>
          🔒 Paiement sécurisé · Fonds débloqués à la livraison
        </p>
      </div>
    </div>
  )
}
