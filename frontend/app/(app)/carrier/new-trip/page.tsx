'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { Button, Input } from '@/components/ui/kipar'
import api from '@/lib/api'

const RED = '#DC0029'
const TAUPE = '#B5AFAB'
const BORDER = '#EEEBE6'

const schema = z.object({
  origin_city: z.string().min(2, 'Requis'),
  origin_airport_code: z.string().length(3, '3 lettres'),
  destination_city: z.string().min(2, 'Requis'),
  destination_airport_code: z.string().length(3, '3 lettres'),
  departure_date: z.string().min(1, 'Requis'),
  flight_number: z.string().optional(),
  total_kg: z.string(),
  max_kg_per_package: z.string(),
  price_per_kg: z.string(),
})

type FormData = z.infer<typeof schema>

export default function NewTripPage() {
  const { t } = useTranslation()
  const router = useRouter()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
  try {
    await api.post('/trips', {
      ...data,
      total_kg: parseFloat(data.total_kg),
      max_kg_per_package: parseFloat(data.max_kg_per_package),
      price_per_kg: parseFloat(data.price_per_kg),
    })
    toast.success('Annonce publiee !')
    router.push('/carrier')
    } catch (err: any) {
    const detail = err.response?.data?.detail
    const msg = Array.isArray(detail)
      ? detail.map((e: any) => e.message).join(' - ')
      : detail || t.errors.generic
    toast.error(msg)
    }
  }

  return (
    <div style={{ background: '#FBFBFF', minHeight: '100vh' }}>
      <div style={{ background: RED, padding: '48px 20px 24px', color: '#fff', position: 'relative' }}>
        <button
          onClick={() => router.back()}
          style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} color="#fff" />
        </button>
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, textAlign: 'center' }}>
          {t.carrier.trip_form_title}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ padding: '24px 20px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Depart</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
            <Input label={t.carrier.origin_label} placeholder="Paris" error={errors.origin_city?.message} {...register('origin_city')} />
            <Input label="IATA" placeholder="CDG" error={errors.origin_airport_code?.message} {...register('origin_airport_code')} />
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Destination</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
            <Input label={t.carrier.dest_label} placeholder="Dakar" error={errors.destination_city?.message} {...register('destination_city')} />
            <Input label="IATA" placeholder="DSS" error={errors.destination_airport_code?.message} {...register('destination_airport_code')} />
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Vol</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label={t.carrier.date_label} type="date" error={errors.departure_date?.message} {...register('departure_date')} />
            <Input label={t.carrier.flight_label} placeholder="AF502" {...register('flight_number')} />
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Capacite et Prix</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Input label={t.carrier.kg_label} type="number" placeholder="20" step="0.5" error={errors.total_kg?.message} {...register('total_kg')} />
            <Input label={t.carrier.max_kg_label} type="number" placeholder="5" step="0.5" error={errors.max_kg_per_package?.message} {...register('max_kg_per_package')} />
            <Input label={t.carrier.price_label} type="number" placeholder="3" step="0.5" error={errors.price_per_kg?.message} {...register('price_per_kg')} />
          </div>
        </div>

        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          {t.carrier.submit_btn}
        </Button>

      </form>
    </div>
  )
}
