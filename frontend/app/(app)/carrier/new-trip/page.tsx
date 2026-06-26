'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { usePersistedForm } from '@/hooks/usePersistedForm'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { Button, Input } from '@/components/ui/kipar'
import Select from '@/components/ui/kipar/Select'
import DatePicker from '@/components/ui/kipar/DatePicker'
import TimePicker from '@/components/ui/kipar/TimePicker'
import HeroHeader from '@/components/layout/HeroHeader'
import HeroBackHeader from '@/components/layout/HeroBackHeader'
import api from '@/lib/api'
import { RED, TAUPE, BORDER, CHARCOAL, SAND, BG, GREEN, WHITE } from '@/lib/theme'
import { useLimits } from '@/hooks/useLimits'
import { useAuthStore } from '@/stores/auth.store'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useResponsive } from '@/hooks/useResponsive'
import { useConfig } from '@/hooks/useConfig'
import { toKg, unitLabel, WeightUnit } from '@/lib/weight'

const makeSchema = (t: any) => z.object({
  origin_city: z.string().min(2, t.validation.required),
  origin_airport_code: z.string().length(3, t.validation.iata_code),
  destination_city: z.string().min(2, t.validation.required),
  destination_airport_code: z.string().length(3, t.validation.iata_code),
  departure_date: z.string().min(1, t.validation.required),
  departure_time: z.string().min(1, t.validation.required),
  arrival_date: z.string().min(1, t.validation.required),
  arrival_time: z.string().min(1, t.validation.required),
  flight_number: z.string().min(1, t.validation.required),
  total_kg: z.string().optional(),
  max_kg_per_package: z.string().optional(),
  price_per_kg: z.string().optional(),
})

type FormData = z.infer<ReturnType<typeof makeSchema>>

export default function NewTripPage() {
  const { t } = useTranslation()
  const schema = useMemo(() => makeSchema(t), [t])
  const router = useRouter()
  const { tripsBlocked, limits } = useLimits()
  const { user } = useAuthStore()
  const config = useConfig()
  const isMobile = useIsMobile()
  const { gridCols } = useResponsive()
  const [weightUnit, setWeightUnit] = useState<WeightUnit>((user?.weight_unit ?? 'kg') as WeightUnit)
  const [tripCurrency, setTripCurrency] = useState(user?.currency ?? 'EUR')

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Local state used by the form (declare before usePersistedForm)
  const [originInput, setOriginInput] = useState('')
  const [flightValid, setFlightValid] = useState<boolean | null>(null)
  const [flightReason, setFlightReason] = useState<string | null>(null)
  const [flightChecking, setFlightChecking] = useState(false)
  const flightDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [departureDate, setDepartureDate] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [arrivalDate, setArrivalDate] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')

  // Persistance du formulaire (sessionStorage)
  const { clear: clearPersist } = usePersistedForm(
    'kipar_form_newtrip',
    {
      flight_number: watch('flight_number'),
      total_kg: watch('total_kg'),
      max_kg_per_package: watch('max_kg_per_package'),
      price_per_kg: watch('price_per_kg'),
      weightUnit, tripCurrency, originInput, departureDate, departureTime, arrivalDate, arrivalTime,
    },
    (s: any) => {
      reset({
        flight_number: s.flight_number,
        total_kg: s.total_kg,
        max_kg_per_package: s.max_kg_per_package,
        price_per_kg: s.price_per_kg,
      })
      if (s.weightUnit) setWeightUnit(s.weightUnit)
      if (s.tripCurrency) setTripCurrency(s.tripCurrency)
      if (s.originInput) setOriginInput(s.originInput)
      if (s.departureDate) setDepartureDate(s.departureDate)
      if (s.departureTime) setDepartureTime(s.departureTime)
      if (s.arrivalDate) setArrivalDate(s.arrivalDate)
      if (s.arrivalTime) setArrivalTime(s.arrivalTime)
    },
  )
  const [destInput, setDestInput] = useState('')
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([])
  const [destSuggestions, setDestSuggestions] = useState<any[]>([])
  const [originSelected, setOriginSelected] = useState(false)
  const [destSelected, setDestSelected] = useState(false)
  const [priceSuggestion, setPriceSuggestion] = useState<{ price_low: number | null; price_high: number | null; is_corridor_data: boolean } | null>(null)
  const [acceptsUrgent, setAcceptsUrgent] = useState(false)
  const [acceptsSmallPackage, setAcceptsSmallPackage] = useState(false)
  const [smallPackagePrice, setSmallPackagePrice] = useState('')
  const [dateTouched, setDateTouched] = useState(false)

  const validateFlight = (value: string) => {
    if (flightDebounce.current) clearTimeout(flightDebounce.current)
    if (!value || value.length < 3) { setFlightValid(null); return }
    setFlightChecking(true)
    flightDebounce.current = setTimeout(async () => {
      try {
        const res = await api.get('/trips/verify-flight', { params: { flight_number: value } })
        setFlightValid(res.data.valid)
        setFlightReason(res.data.reason || null)
      } catch { setFlightValid(false); setFlightReason(null) }
      finally { setFlightChecking(false) }
    }, 600)
  }

  const searchAirports = async (q: string, setSuggestions: (s: any[]) => void) => {
    if (q.length < 1) { setSuggestions([]); return }
    try {
      const res = await api.get('/airports?q=' + encodeURIComponent(q) + '&limit=6', { headers: {} })
      setSuggestions(res.data.results || [])
    } catch {
      setSuggestions([])
    }
  }

  const fetchPriceSuggestion = async (origin: string, destination: string) => {
    try {
      const res = await api.get('/trips/price-suggestion', { params: { origin, destination } })
      const d = res.data
      if (d.price_low !== null && d.price_high !== null) {
        setPriceSuggestion({ price_low: d.price_low, price_high: d.price_high, is_corridor_data: d.is_corridor_data })
      } else {
        setPriceSuggestion(null)
      }
    } catch {
      setPriceSuggestion(null)
    }
  }

  const selectOrigin = (a: any) => {
    setOriginInput(a.code + ' \u2014 ' + a.city)
    setValue('origin_city', a.city)
    setValue('origin_airport_code', a.code)
    setOriginSuggestions([])
    setOriginSelected(true)
    if (destSelected) fetchPriceSuggestion(a.code, destInput.split(' \u2014 ')[0])
  }

  const selectDest = (a: any) => {
    setDestInput(a.code + ' \u2014 ' + a.city)
    setValue('destination_city', a.city)
    setValue('destination_airport_code', a.code)
    setDestSuggestions([])
    setDestSelected(true)
    if (originSelected) fetchPriceSuggestion(originInput.split(' \u2014 ')[0], a.code)
  }

  const onSubmit = async (data: FormData) => {
    const hasKg = !!(data.total_kg && data.price_per_kg)
    const hasSmall = acceptsSmallPackage && !!smallPackagePrice
    if (!hasKg && !hasSmall) {
      toast.error(t.carrier.at_least_one_mode)
      return
    }
    if ((data.total_kg && !data.price_per_kg) || (!data.total_kg && data.price_per_kg)) {
      toast.error(t.carrier.kg_mode_incomplete)
      return
    }
    // Validation delai minimum avant depart
    if (data.departure_date) {
      const depTime = departureTime || '00:00'
      const [h, m] = depTime.split(':').map(Number)
      const depDt = new Date(data.departure_date + 'T00:00:00Z')
      depDt.setUTCHours(h, m, 0, 0)
      const hoursUntil = (depDt.getTime() - Date.now()) / 3600000
      if (hoursUntil <= 0) {
        toast.error(t.errors.trip_departure_past)
        return
      }
      if (acceptsUrgent && hoursUntil < config.trip.publish_urgent_min_hours) {
        toast.error(t.errors.trip_too_close_urgent)
        return
      }
      if (!acceptsUrgent && hoursUntil < config.trip.publish_normal_min_hours) {
        toast.error(t.errors.trip_too_close_normal)
        return
      } 
    }
    try {
      await api.post('/trips', {
        ...data,
        total_kg: data.total_kg ? parseFloat(data.total_kg) : null,
        max_kg_per_package: data.max_kg_per_package ? parseFloat(data.max_kg_per_package) : undefined,
        price_per_kg: data.price_per_kg ? parseFloat(data.price_per_kg) : null,
        weight_unit: weightUnit,
        currency: tripCurrency,
        accepts_urgent: acceptsUrgent,
        small_package_price: acceptsSmallPackage && smallPackagePrice ? parseFloat(smallPackagePrice) : null,
        arrival_date: arrivalDate || undefined,
      })
      toast.success(t.carrier.trip_published)
      clearPersist()
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
            <p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>{a.name} \u00b7 {a.country}</p>
          </div>
        </div>
      ))}
    </div>
  )

  if (tripsBlocked) {
    return (
      <div style={{ minHeight: '100vh', background: 'rgba(240,237,232,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 24, padding: '32px 24px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>🔒</p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#92400E', marginBottom: 8 }}>{t.carrier.limit_reached_title}</h2>
          <p style={{ fontSize: 14, color: '#92400E', marginBottom: 4 }}>
            {limits?.trips.current}/{limits?.trips.max} utilisés en gratuit
          </p>
          <p style={{ fontSize: 13, color: '#92400E', marginBottom: 20 }}>
            Passez à Premium pour continuer sans limite.
          </p>
          <button onClick={() => router.push('/premium')}
            style={{ background: '#DC0029', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
            Débloquer Premium
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>

      <HeroBackHeader
        imageUrl="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80"
        title={t.carrier.trip_form_title}
        minHeight={140}
        gradient="vertical"
      />

      <form onSubmit={handleSubmit(onSubmit)} style={{ padding: '24px 20px 100px', display: 'flex', flexDirection: 'column', gap: 16 }} className="md:max-w-3xl md:mx-auto">

        {/* Départ + Destination */}
        <div style={{ display: 'grid', gridTemplateColumns: gridCols === 1 ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{t.carrier.section_departure}</p>
            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: CHARCOAL, marginBottom: 6 }}>{t.carrier.origin_label} *</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: BG, borderRadius: 10, padding: '10px 12px', border: '1px solid ' + BORDER }}>
                <Search size={13} color={TAUPE} />
                <input value={originInput}
                  onChange={e => { setOriginInput(e.target.value); setOriginSelected(false); setPriceSuggestion(null); searchAirports(e.target.value, setOriginSuggestions) }}
                  placeholder={t.search.origin_placeholder}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: CHARCOAL, fontSize: 13, minWidth: 0 }} />
                {originInput && (
                  <button type="button" onClick={() => { setOriginInput(''); setOriginSuggestions([]); setOriginSelected(false); setPriceSuggestion(null); setValue('origin_city', ''); setValue('origin_airport_code', '') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <X size={12} color={TAUPE} />
                  </button>
                )}
              </div>
              {originSelected && <p style={{ fontSize: 11, color: GREEN, marginTop: 4 }}>{t.carrier.airport_selected}</p>}
              {errors.origin_airport_code && <p style={{ fontSize: 11, color: RED, marginTop: 4 }}>{errors.origin_airport_code.message}</p>}
              {originSuggestions.length > 0 && airportDropdown(originSuggestions, selectOrigin)}
            </div>
          </div>

          <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{t.carrier.section_destination}</p>
            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: CHARCOAL, marginBottom: 6 }}>{t.carrier.dest_label} *</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: BG, borderRadius: 10, padding: '10px 12px', border: '1px solid ' + BORDER }}>
                <Search size={13} color={TAUPE} />
                <input value={destInput}
                  onChange={e => { setDestInput(e.target.value); setDestSelected(false); setPriceSuggestion(null); searchAirports(e.target.value, setDestSuggestions) }}
                  placeholder={t.search.dest_placeholder}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: CHARCOAL, fontSize: 13, minWidth: 0 }} />
                {destInput && (
                  <button type="button" onClick={() => { setDestInput(''); setDestSuggestions([]); setDestSelected(false); setPriceSuggestion(null); setValue('destination_city', ''); setValue('destination_airport_code', '') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <X size={12} color={TAUPE} />
                  </button>
                )}
              </div>
              {destSelected && <p style={{ fontSize: 11, color: GREEN, marginTop: 4 }}>{t.carrier.airport_selected}</p>}
              {errors.destination_airport_code && <p style={{ fontSize: 11, color: RED, marginTop: 4 }}>{errors.destination_airport_code.message}</p>}
              {destSuggestions.length > 0 && airportDropdown(destSuggestions, selectDest)}
            </div>
          </div>
        </div>

        {/* Toggle colis urgents */}
        <div style={{ background: 'var(--k-white,#fff)', borderRadius: 16, padding: 16, border: '1px solid var(--k-border,#E8E3DD)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--k-charcoal,#1A1A1A)', margin: 0 }}>{t.carrier.accepts_urgent_label}</p>
            <p style={{ fontSize: 12, color: 'var(--k-taupe,#8C7B6B)', marginTop: 4 }}>{t.carrier.accepts_urgent_desc}</p>
          </div>
          <button type="button"
            onClick={() => user?.is_premium ? setAcceptsUrgent(v => !v) : router.push('/premium')}
            title={user?.is_premium ? '' : (t.carrier.accepts_urgent_premium ?? 'Fonctionnalité Premium')}
            style={{ width: 48, height: 28, borderRadius: 14, background: acceptsUrgent && user?.is_premium ? 'var(--k-red,#DC0029)' : 'var(--k-border,#E8E3DD)', border: 'none', cursor: user?.is_premium ? 'pointer' : 'not-allowed', position: 'relative', transition: 'background 0.2s', flexShrink: 0, opacity: user?.is_premium ? 1 : 0.5 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: acceptsUrgent && user?.is_premium ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
          </button>
          {!user?.is_premium && (
            <span style={{ fontSize: 10, color: '#92400E', background: '#FFF3CD', border: '1px solid #FFE082', borderRadius: 99, padding: '2px 8px', fontWeight: 700, marginLeft: 4, alignSelf: 'center' }}>
              Premium
            </span>
          )}
        </div>

        {/* Petits colis */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--k-charcoal,#1A1A1A)', margin: 0 }}>{t.carrier.small_package_label}</p>
              <p style={{ fontSize: 12, color: 'var(--k-taupe,#8C7B6B)', marginTop: 4 }}>{t.carrier.small_package_desc}</p>
            </div>
            <button type='button'
              onClick={() => setAcceptsSmallPackage(v => !v)}
              style={{ width: 48, height: 28, borderRadius: 14, background: acceptsSmallPackage ? 'var(--k-red,#DC0029)' : 'var(--k-border,#E8E3DD)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: acceptsSmallPackage ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
            </button>
          </div>
          {acceptsSmallPackage && (
            <div style={{ marginTop: 12 }}>
              <Input
                label={t.carrier.small_package_price_label}
                type='number'
                placeholder={t.carrier.small_package_price_placeholder}
                min='5'
                max='10'
                step='0.5'
                value={smallPackagePrice}
                onChange={e => setSmallPackagePrice(e.target.value)}
              />
              <p style={{ fontSize: 11, color: 'var(--k-taupe,#8C7B6B)', marginTop: 6 }}>{t.carrier.small_package_price_hint}</p>
            </div>
          )}
        </div>

        {/* Vol */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{t.carrier.section_flight}</p>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols === 1 ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <DatePicker label={`${t.carrier.date_label} *`} value={departureDate}
                onChange={v => { setDepartureDate(v); setValue('departure_date', v); setDateTouched(true) }}
                error={errors.departure_date?.message}
                min={(() => {
                  const d = new Date()
                  d.setHours(d.getHours() + (acceptsUrgent ? config.trip.publish_urgent_min_hours : config.trip.publish_normal_min_hours))
                  return d.toISOString().slice(0, 10)
                })()} />
              {dateTouched && (
                <p style={{ fontSize: 11, color: '#2563EB', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>&#9432;</span>
                  {acceptsUrgent ? t.errors.trip_too_close_urgent : t.errors.trip_too_close_normal}
                </p>
              )}
            </div>
            <DatePicker label={`${t.carrier.arrival_date_label || 'Date d\'arrivée'} *`} value={arrivalDate}
              onChange={v => { setArrivalDate(v); setValue('arrival_date', v) }}
              error={errors.arrival_date?.message}
              min={departureDate || new Date().toISOString().slice(0,10)}
              defaultView={departureDate || undefined} />
            <div>
              <Input label={`${t.carrier.flight_label} *`} placeholder="AF502"
                error={errors.flight_number?.message}
                {...register('flight_number')}
                onChange={e => { register('flight_number').onChange(e); validateFlight(e.target.value) }}
              />
              {flightChecking && <p style={{ fontSize: 11, color: TAUPE, marginTop: 4 }}>...</p>}
              {flightValid === true && <p style={{ fontSize: 11, color: GREEN, marginTop: 4 }}>{'\u2713'} {t.carrier.flight_valid}</p>}
              {flightValid === false && flightReason === 'invalid_format' && <p style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{'\u26a0'} {t.carrier.flight_invalid_format}</p>}
              {flightValid === false && flightReason !== 'invalid_format' && <p style={{ fontSize: 11, color: '#EA580C', marginTop: 4 }}>{'\u26a0'} {t.carrier.flight_not_found_advisory}</p>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols === 1 ? '1fr' : '1fr 1fr', gap: 10 }}>
            <TimePicker label={`${t.carrier.departure_time_label} *`} value={departureTime}
              error={errors.departure_time?.message}
              onChange={v => { setDepartureTime(v); setValue('departure_time', v) }} />
            <TimePicker label={`${t.carrier.arrival_time_label} *`} value={arrivalTime}
              error={errors.arrival_time?.message}
              onChange={v => { setArrivalTime(v); setValue('arrival_time', v) }} />
          </div>
        </div>

        {/* Capacité et Prix */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{t.carrier.section_capacity}</p>
          {/* Selecteurs unite et devise par trip */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols === 1 ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: CHARCOAL, marginBottom: 6 }}>{t.carrier.weight_unit_label ?? 'Unité de poids'}</p>
              <Select value={weightUnit} onChange={e => setWeightUnit(e.target.value as WeightUnit)}>
                <option value="kg">{t.profile_edit.weight_unit_kg_long}</option>
                <option value="lb">{t.profile_edit.weight_unit_lb_long}</option>
              </Select>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: CHARCOAL, marginBottom: 6 }}>{t.carrier.currency_label ?? 'Devise'}</p>
              <Select value={tripCurrency} onChange={e => setTripCurrency(e.target.value)}>
                {['EUR','USD','GBP','XOF','XAF','MAD','NGN','GHS','KES','CAD','CHF'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols === 1 ? '1fr' : gridCols === 2 ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <Input label={`${t.carrier.capacity_label} (${unitLabel(weightUnit)})`} type="number" placeholder="20" step="0.5" error={errors.total_kg?.message} {...register('total_kg')} />
            <Input label={`${t.carrier.max_per_package_label} (${unitLabel(weightUnit)})`} type="number" placeholder="5" step="0.5" error={errors.max_kg_per_package?.message} {...register('max_kg_per_package')} />
            <div>
              <Input label={`${t.carrier.price_per_label} ${unitLabel(weightUnit)} (${tripCurrency})`} type="number" placeholder="3" step="0.5" error={errors.price_per_kg?.message} {...register('price_per_kg')} />
              {(() => {
                const raw = parseFloat(watch('price_per_kg') || '0')
                const net = raw * 0.98
                return raw > 0 ? (
                  <p style={{ fontSize: 11, color: '#16A34A', marginTop: 2, fontWeight: 600 }}>
                    {'\u2192'} {t.carrier.net_per_unit ?? 'Net perçu'} : {net.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {tripCurrency} / {unitLabel(weightUnit)}
                  </p>
                ) : null
              })()}
              {priceSuggestion && (
                <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                  {'\uD83D\uDCA1'} {priceSuggestion.is_corridor_data ? t.carrier.price_suggestion_corridor : t.carrier.price_suggestion_global}{' '}
                  {priceSuggestion.price_low?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {'\u2013'} {priceSuggestion.price_high?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {tripCurrency} / {unitLabel(weightUnit)}
                </p>
              )}
            </div>
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