'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from '@/hooks/useTranslation'
import { useBookingStore } from '@/stores/booking.store'
import { Button, Input } from '@/components/ui/kipar'
import api from '@/lib/api'

import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER } from '@/lib/theme'

const schema = z.object({
  receiver_email_or_phone: z.string().min(3, 'Requis'),
  content_description: z.string().min(3, 'Décrivez le contenu'),
  weight_kg: z.string().min(1, 'Requis'),
  declared_value: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function BookPage() {
  const { id } = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const { selectedTrip, setCurrentBookingId } = useBookingStore()
  const [withInsurance, setWithInsurance] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const weight = parseFloat(watch('weight_kg') || '0') || 0
  const value = parseFloat(watch('declared_value') || '0') || 0
  const pricePerKg = selectedTrip?.price_per_kg || 0
  const transport = weight * pricePerKg
  const commission = transport * 0.13
  const insurance = withInsurance ? value * 0.03 : 0
  const total = transport + commission + insurance

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await api.post('/bookings', {
        trip_id: id,
        receiver_email_or_phone: data.receiver_email_or_phone,
        content_description: data.content_description,
        weight_kg: parseFloat(data.weight_kg),
        declared_value: parseFloat(data.declared_value || '0'),
        insurance_subscribed: withInsurance,
      })
      return res.data
    },
    onSuccess: (data) => {
      setCurrentBookingId(data.id)
      router.push(`/trips/${id}/book/payment?booking_id=${data.id}&amount=${(transport + commission).toFixed(2)}&declared_value=${value}`)
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => e.message).join(' — ')
        : detail || t.errors.generic
      toast.error(msg)
    },
  })

  return (
    <div style={{ background: '#FBFBFF', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: RED, padding: '48px 20px 24px', color: '#fff', position: 'relative' }}>
        <button
          onClick={() => router.back()}
          style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} color="#fff" />
        </button>
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, textAlign: 'center' }}>
          {t.booking.title}
        </h1>
        {selectedTrip && (
          <p style={{ textAlign: 'center', fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            {selectedTrip.origin_airport_code} → {selectedTrip.destination_airport_code} · {selectedTrip.price_per_kg}€/kg
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Récepteur */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Récepteur
          </p>
          <Input
            label={t.booking.receiver_label}
            placeholder={t.booking.receiver_placeholder}
            type="email"
            error={errors.receiver_email_or_phone?.message}
            {...register('receiver_email_or_phone')}
          />
        </div>

        {/* Colis */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Colis
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input
              label={t.booking.content_label}
              placeholder={t.booking.content_placeholder}
              error={errors.content_description?.message}
              {...register('content_description')}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input
                label={t.booking.weight_label}
                type="number"
                placeholder="2.5"
                step="0.1"
                min="0.1"
                error={errors.weight_kg?.message}
                {...register('weight_kg')}
              />
              <Input
                label={t.booking.value_label}
                type="number"
                placeholder="50"
                min="0"
                {...register('declared_value')}
              />
            </div>
          </div>
        </div>

        {/* Assurance */}
        <div
          style={{ background: '#fff', borderRadius: 16, padding: 16, border: `1px solid ${withInsurance ? RED : BORDER}`, cursor: 'pointer', transition: 'all 0.2s' }}
          onClick={() => setWithInsurance(!withInsurance)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>Assurance colis</p>
              <p style={{ fontSize: 12, color: TAUPE, marginTop: 2 }}>3% de la valeur déclarée · {insurance > 0 ? `+${insurance.toFixed(2)}€` : 'Entrez une valeur'}</p>
            </div>
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${withInsurance ? RED : BORDER}`, background: withInsurance ? RED : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              {withInsurance && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
            </div>
          </div>
        </div>

        {/* Récapitulatif */}
        <div style={{ background: SAND, borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Récapitulatif
          </p>
          {[
            { label: t.booking.transport_cost, value: transport > 0 ? `${transport.toFixed(2)}€` : '—' },
            { label: t.booking.commission, value: commission > 0 ? `${commission.toFixed(2)}€` : '—' },
            ...(withInsurance ? [{ label: 'Assurance', value: `${insurance.toFixed(2)}€` }] : []),
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: CHARCOAL2 }}>
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: CHARCOAL }}>
            <span>{t.booking.total}</span>
            <span>{total > 0 ? `${total.toFixed(2)}€` : '—'}</span>
          </div>
        </div>

        <Button type="submit" fullWidth size="lg" loading={mutation.isPending}>
          {t.booking.confirm_btn}
        </Button>
      </form>
    </div>
  )
}
