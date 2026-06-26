'use client'
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { Input } from '@/components/ui/kipar'
import DatePicker from '@/components/ui/kipar/DatePicker'
import TimePicker from '@/components/ui/kipar/TimePicker'
import AirportInput, { AirportSuggestion } from '@/components/trips/AirportInput'
import InfoTooltip from '@/components/ui/InfoTooltip'
import { RED, CHARCOAL, TAUPE, WHITE } from '@/lib/theme'
import { useGuestPublish, GuestUserInfo } from './useGuestPublish'

const FIELD_BORDER = '#D8D2CA'
const inputStyle = { background: WHITE, borderColor: FIELD_BORDER } as const

async function searchAirports(q: string): Promise<AirportSuggestion[]> {
  if (q.length < 1) return []
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  try {
    const res = await fetch(`${base}/airports?q=${encodeURIComponent(q)}&limit=6`)
    const data = await res.json()
    return data.results || []
  } catch { return [] }
}

interface Props { isVisitor: boolean; isMobile: boolean }

export default function CarrierPublishTab({ isVisitor, isMobile }: Props) {
  const { t } = useTranslation()
  const { submitPublish, submitting } = useGuestPublish()

  const [step, setStep] = useState(0)

  const [originInput, setOriginInput] = useState('')
  const [originCity, setOriginCity] = useState('')
  const [originCode, setOriginCode] = useState('')
  const [originSug, setOriginSug] = useState<AirportSuggestion[]>([])
  const [destInput, setDestInput] = useState('')
  const [destCity, setDestCity] = useState('')
  const [destCode, setDestCode] = useState('')
  const [destSug, setDestSug] = useState<AirportSuggestion[]>([])

  const [departureDate, setDepartureDate] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [arrivalDate, setArrivalDate] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [flightNumber, setFlightNumber] = useState('')

  const [totalKg, setTotalKg] = useState('')
  const [pricePerKg, setPricePerKg] = useState('')
  const [acceptsSmall, setAcceptsSmall] = useState(false)
  const [smallPrice, setSmallPrice] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cgu, setCgu] = useState(false)

  // Etapes : trajet / vol+tarif / (vos infos si visiteur)
  const steps = useMemo(() => {
    const base = ['trajet', 'vol']
    return isVisitor ? [...base, 'infos'] : base
  }, [isVisitor])
  const lastStep = steps.length - 1

  const handleOriginSelect = (a: AirportSuggestion) => {
    setOriginCode(a.code); setOriginCity(a.city || a.code)
    setOriginInput(`${a.city || a.code} \u2014 ${a.code}`); setOriginSug([])
  }
  const handleDestSelect = (a: AirportSuggestion) => {
    setDestCode(a.code); setDestCity(a.city || a.code)
    setDestInput(`${a.city || a.code} \u2014 ${a.code}`); setDestSug([])
  }

  const validateStep = (s: string): boolean => {
    if (s === 'trajet') {
      if (!originCode || !destCode) { toast.error(t.carrier.airport_required); return false }
    }
    if (s === 'vol') {
      if (!departureDate || !departureTime || !arrivalDate || !arrivalTime || !flightNumber) {
        toast.error(t.carrier.flight_fields_required); return false
      }
      const hasKg = !!(totalKg && pricePerKg)
      const hasSmall = acceptsSmall && !!smallPrice
      if (!hasKg && !hasSmall) { toast.error(t.carrier.at_least_one_mode); return false }
      if ((totalKg && !pricePerKg) || (!totalKg && pricePerKg)) { toast.error(t.carrier.kg_mode_incomplete); return false }
    }
    if (s === 'infos') {
      if (!firstName || !lastName || !email || !password) { toast.error(t.validation.required); return false }
      if (!cgu) { toast.error(t.auth.cgu_required); return false }
    }
    return true
  }

  const next = () => { if (validateStep(steps[step])) setStep(s => Math.min(s + 1, lastStep)) }
  const prev = () => setStep(s => Math.max(s - 1, 0))

  const onSubmit = async () => {
    if (!validateStep(steps[step])) return
    const payload: Record<string, any> = {
      origin_city: originCity, origin_airport_code: originCode,
      destination_city: destCity, destination_airport_code: destCode,
      departure_date: departureDate, departure_time: departureTime,
      arrival_date: arrivalDate, arrival_time: arrivalTime,
      flight_number: flightNumber,
      total_kg: totalKg ? parseFloat(totalKg) : null,
      price_per_kg: pricePerKg ? parseFloat(pricePerKg) : null,
      small_package_price: acceptsSmall && smallPrice ? parseFloat(smallPrice) : null,
    }
    const userInfo: GuestUserInfo | undefined = isVisitor
      ? { first_name: firstName, last_name: lastName, email, password, cgu_accepted: cgu }
      : undefined
    await submitPublish('trip', payload, userInfo)
  }

  const grid2 = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 } as const
  const fieldLabel = { fontSize: 12, fontWeight: 500 as const, color: CHARCOAL, marginBottom: 6, display: 'flex', alignItems: 'center' } as const

  const currentStep = steps[step]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 380 }}>
      {/* Progression */}
      <div>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {(t.publish.step_label ?? 'Étape')} {step + 1}/{steps.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? RED : FIELD_BORDER, transition: 'background 0.2s' }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {currentStep === 'trajet' && (
          <div style={grid2}>
            <AirportInput light label={t.carrier.origin_label} placeholder={'Ex: CDG, Paris...'}
              value={originInput}
              onChange={v => { setOriginInput(v); setOriginCode(''); searchAirports(v).then(setOriginSug) }}
              onSelect={handleOriginSelect}
              onClear={() => { setOriginInput(''); setOriginCode(''); setOriginSug([]) }}
              suggestions={originSug} />
            <AirportInput light label={t.carrier.dest_label} placeholder={'Ex: DSS, Dakar...'}
              value={destInput}
              onChange={v => { setDestInput(v); setDestCode(''); searchAirports(v).then(setDestSug) }}
              onSelect={handleDestSelect}
              onClear={() => { setDestInput(''); setDestCode(''); setDestSug([]) }}
              suggestions={destSug} />
          </div>
        )}

        {currentStep === 'vol' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={grid2}>
              <DatePicker label={t.carrier.date_label} required value={departureDate} onChange={setDepartureDate}
                min={new Date().toISOString().slice(0, 10)} />
              <DatePicker label={t.carrier.arrival_date_label || 'Date d\'arrivee'} required value={arrivalDate} onChange={setArrivalDate}
                min={departureDate || new Date().toISOString().slice(0, 10)} defaultView={departureDate || undefined} />
            </div>
            <div style={grid2}>
              <TimePicker label={t.carrier.departure_time_label} required value={departureTime} onChange={setDepartureTime} />
              <TimePicker label={t.carrier.arrival_time_label} required value={arrivalTime} onChange={setArrivalTime} />
            </div>
            <Input label={t.carrier.flight_label} required placeholder="AF502"
              value={flightNumber} onChange={e => setFlightNumber(e.target.value)} style={inputStyle} />
            <div>
              <p style={fieldLabel}>
                {t.carrier.section_capacity}<InfoTooltip text={t.publish.tip_mode} />
              </p>
              <div style={grid2}>
                <Input label={t.carrier.capacity_label} type="number" step="0.5" placeholder="20"
                  value={totalKg} onChange={e => setTotalKg(e.target.value)} style={inputStyle} />
                <Input label={t.carrier.price_per_label} type="number" step="0.5" placeholder="3"
                  value={pricePerKg} onChange={e => setPricePerKg(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: '4px 0' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL }}>{t.carrier.small_package_label}</span>
                <button type="button" onClick={() => setAcceptsSmall(v => !v)}
                  style={{ width: 44, height: 26, borderRadius: 13, background: acceptsSmall ? RED : FIELD_BORDER, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: acceptsSmall ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
                </button>
              </div>
              {acceptsSmall && (
                <Input label={t.carrier.small_package_price_label} type="number" step="0.5" placeholder="5"
                  value={smallPrice} onChange={e => setSmallPrice(e.target.value)} style={inputStyle} />
              )}
            </div>
          </div>
        )}

        {currentStep === 'infos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={grid2}>
              <Input label={t.auth.first_name} required value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
              <Input label={t.auth.last_name} required value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
            </div>
            <Input label={t.auth.email_label} type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            <Input label={t.auth.password_label} type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: TAUPE, cursor: 'pointer' }}>
              <input type="checkbox" checked={cgu} onChange={e => setCgu(e.target.checked)} style={{ marginTop: 2, accentColor: RED }} />
              <span>{t.auth.cgu_label}</span>
            </label>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {step > 0 && (
          <button type="button" onClick={prev}
            style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '12px 16px', borderRadius: 12, border: `1px solid ${FIELD_BORDER}`, background: WHITE, color: CHARCOAL, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <ChevronLeft size={16} /> {t.publish.prev_btn ?? 'Précédent'}
          </button>
        )}
        {step < lastStep ? (
          <button type="button" onClick={next}
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px', borderRadius: 12, border: 'none', background: RED, color: WHITE, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(220,0,41,0.3)' }}>
            {t.publish.next_btn ?? 'Suivant'} <ChevronRight size={16} />
          </button>
        ) : (
          <button type="button" onClick={onSubmit} disabled={submitting}
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: 12, border: 'none', background: RED, color: WHITE, fontSize: 14, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1, boxShadow: '0 4px 16px rgba(220,0,41,0.3)' }}>
            {submitting ? '...' : t.publish.publish_trip_cta}
          </button>
        )}
      </div>
    </div>
  )
}