'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { Button, Input } from '@/components/ui/kipar'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { RED, TAUPE, BORDER, CHARCOAL, SAND, BG, GREEN, WHITE } from '@/lib/theme'

const schema = z.object({
  origin_city: z.string().min(2, 'Requis'),
  origin_airport_code: z.string().length(3, '3 lettres'),
  destination_city: z.string().min(2, 'Requis'),
  destination_airport_code: z.string().length(3, '3 lettres'),
  departure_date: z.string().min(1, 'Requis'),
  departure_time: z.string().optional(),
  arrival_time: z.string().optional(),
  flight_number: z.string().optional(),
  total_kg: z.string(),
  max_kg_per_package: z.string(),
  price_per_kg: z.string(),
})

type FormData = z.infer<typeof schema>

export default function NewTripPage() {
  const { t } = useTranslation()
  const router = useRouter()

  const [originInput, setOriginInput] = useState('')
  const [destInput, setDestInput] = useState('')
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([])
  const [destSuggestions, setDestSuggestions] = useState<any[]>([])
  const [originSelected, setOriginSelected] = useState(false)
  const [destSelected, setDestSelected] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const searchAirports = async (q: string, setSuggestions: (s: any[]) => void) => {
    if (q.length < 1) { setSuggestions([]); return }
    try {
      const res = await api.get('/airports?q=' + encodeURIComponent(q) + '&limit=6', { headers: {} })
      setSuggestions(res.data.results || [])
    } catch {
      setSuggestions([])
    }
  }

  const selectOrigin = (a: any) => {
    setOriginInput(a.code + ' — ' + a.city)
    setValue('origin_city', a.city)
    setValue('origin_airport_code', a.code)
    setOriginSuggestions([])
    setOriginSelected(true)
  }

  const selectDest = (a: any) => {
    setDestInput(a.code + ' — ' + a.city)
    setValue('destination_city', a.city)
    setValue('destination_airport_code', a.code)
    setDestSuggestions([])
    setDestSelected(true)
  }

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/trips', {
        ...data,
        total_kg: parseFloat(data.total_kg),
        max_kg_per_package: parseFloat(data.max_kg_per_package),
        price_per_kg: parseFloat(data.price_per_kg),
      })
      toast.success('Annonce publiée !')
      router.push('/carrier')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => e.message).join(' - ')
        : detail || t.errors.generic
      toast.error(msg)
    }
  }

  const airportDropdown = (suggestions: any[], onSelect: (a: any) => void) => (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: WHITE, borderRadius: 10, marginTop: 4, overflow: 'hidden', zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
      {suggestions.map((a: any) => (
        <div key={a.code} onClick={() => onSelect(a)}
          style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid ' + SAND, display: 'flex', alignItems: 'center', gap: 10 }}
          onMouseEnter={e => (e.currentTarget.style.background = SAND)}
          onMouseLeave={e => (e.currentTarget.style.background = WHITE)}>
          <span style={{ fontFamily: 'var(--font-syne,Syne)', fontWeight: 700, color: CHARCOAL, fontSize: 13, minWidth: 36 }}>{a.code}</span>
          <div>
            <p style={{ fontSize: 13, color: CHARCOAL, fontWeight: 500, margin: 0 }}>{a.city}</p>
            <p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>{a.name} · {a.country}</p>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>

      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80"
        minHeight={140}
        gradient="vertical"
      >
        <div style={{ padding: '48px 20px 24px', position: 'relative' }}>
          <button
            onClick={() => router.back()}
            style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} color="#fff" />
          </button>
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
            {t.carrier.trip_form_title}
          </h1>
        </div>
      </HeroHeader>

      <form onSubmit={handleSubmit(onSubmit)} style={{ padding: '24px 20px 100px', display: 'flex', flexDirection: 'column', gap: 16 }} className="md:max-w-3xl md:mx-auto">

        {/* Départ + Destination */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Départ</p>
            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: CHARCOAL, marginBottom: 6 }}>{t.carrier.origin_label}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: BG, borderRadius: 10, padding: '10px 12px', border: '1px solid ' + BORDER }}>
                <Search size={13} color={TAUPE} />
                <input value={originInput}
                  onChange={e => { setOriginInput(e.target.value); setOriginSelected(false); searchAirports(e.target.value, setOriginSuggestions) }}
                  placeholder="Ex: CDG..."
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: CHARCOAL, fontSize: 13, minWidth: 0 }} />
                {originInput && (
                  <button type="button" onClick={() => { setOriginInput(''); setOriginSuggestions([]); setOriginSelected(false); setValue('origin_city', ''); setValue('origin_airport_code', '') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <X size={12} color={TAUPE} />
                  </button>
                )}
              </div>
              {originSelected && <p style={{ fontSize: 11, color: GREEN, marginTop: 4 }}>✓ Sélectionné</p>}
              {errors.origin_airport_code && <p style={{ fontSize: 11, color: RED, marginTop: 4 }}>{errors.origin_airport_code.message}</p>}
              {originSuggestions.length > 0 && airportDropdown(originSuggestions, selectOrigin)}
            </div>
          </div>

          <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Destination</p>
            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: CHARCOAL, marginBottom: 6 }}>{t.carrier.dest_label}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: BG, borderRadius: 10, padding: '10px 12px', border: '1px solid ' + BORDER }}>
                <Search size={13} color={TAUPE} />
                <input value={destInput}
                  onChange={e => { setDestInput(e.target.value); setDestSelected(false); searchAirports(e.target.value, setDestSuggestions) }}
                  placeholder="Ex: DSS..."
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: CHARCOAL, fontSize: 13, minWidth: 0 }} />
                {destInput && (
                  <button type="button" onClick={() => { setDestInput(''); setDestSuggestions([]); setDestSelected(false); setValue('destination_city', ''); setValue('destination_airport_code', '') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <X size={12} color={TAUPE} />
                  </button>
                )}
              </div>
              {destSelected && <p style={{ fontSize: 11, color: GREEN, marginTop: 4 }}>✓ Sélectionné</p>}
              {errors.destination_airport_code && <p style={{ fontSize: 11, color: RED, marginTop: 4 }}>{errors.destination_airport_code.message}</p>}
              {destSuggestions.length > 0 && airportDropdown(destSuggestions, selectDest)}
            </div>
          </div>
        </div>

        {/* Vol */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Vol</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Input label={t.carrier.date_label} type="date" error={errors.departure_date?.message} {...register('departure_date')} />
            <Input label={t.carrier.flight_label} placeholder="AF502" {...register('flight_number')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label={t.carrier.departure_time_label} type="time" {...register('departure_time')} />
            <Input label={t.carrier.arrival_time_label} type="time" {...register('arrival_time')} />
          </div>
        </div>

        {/* Capacité et Prix */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Capacité et Prix</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Input label={t.carrier.kg_label} type="number" placeholder="20" step="0.5" error={errors.total_kg?.message} {...register('total_kg')} />
            <Input label={t.carrier.max_kg_label} type="number" placeholder="5" step="0.5" error={errors.max_kg_per_package?.message} {...register('max_kg_per_package')} />
            <Input label={t.carrier.price_label} type="number" placeholder="3" step="0.5" error={errors.price_per_kg?.message} {...register('price_per_kg')} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button type="submit" size="lg" loading={isSubmitting}>
            {t.carrier.submit_btn}
          </Button>
        </div>

      </form>
    </div>
  )
}