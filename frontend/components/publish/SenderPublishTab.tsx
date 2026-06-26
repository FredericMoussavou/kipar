'use client'
import { useState, useRef, useMemo } from 'react'
import { Upload, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { useConfig } from '@/hooks/useConfig'
import { Input } from '@/components/ui/kipar'
import DatePicker from '@/components/ui/kipar/DatePicker'
import AirportInput, { AirportSuggestion } from '@/components/trips/AirportInput'
import InfoTooltip from '@/components/ui/InfoTooltip'
import { RED, CHARCOAL, TAUPE, WHITE } from '@/lib/theme'
import { useGuestPublish, GuestUserInfo } from './useGuestPublish'

const CLOUDINARY_CLOUD = 'dzlhxae2z'
const CLOUDINARY_PRESET = 'kipar_package_photos'
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

export default function SenderPublishTab({ isVisitor, isMobile }: Props) {
  const { t } = useTranslation()
  const config = useConfig()
  const SMALL_MAX_KG = config.small_package.max_kg
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

  const [mode, setMode] = useState<'kg' | 'small'>('kg')
  const [description, setDescription] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [budgetPerKg, setBudgetPerKg] = useState('')
  const [receiver, setReceiver] = useState('')
  const [deadline, setDeadline] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cgu, setCgu] = useState(false)
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register')

  // Etapes : colis / trajet / (vos infos si visiteur)
  const steps = useMemo(() => {
    const base = ['colis', 'trajet']
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

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const remaining = 3 - photos.length
    if (remaining <= 0) return
    const toUpload = Array.from(files).slice(0, remaining)
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of toUpload) {
        const fd = new FormData()
        fd.append('file', file); fd.append('upload_preset', CLOUDINARY_PRESET)
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd })
        const data = await res.json()
        if (data.secure_url) urls.push(data.secure_url)
      }
      setPhotos(prev => [...prev, ...urls].slice(0, 3))
    } catch { toast.error(t.errors.generic) } finally { setUploading(false) }
  }

  // validation par etape
  const validateStep = (s: string): boolean => {
    if (s === 'colis') {
      if (!description || !weightKg) { toast.error(t.validation.required); return false }
      if (mode === 'small' && parseFloat(weightKg) >= SMALL_MAX_KG) { toast.error(t.booking.weight_too_big_for_small); return false }
      if (mode === 'kg' && !budgetPerKg) { toast.error(t.validation.required); return false }
      if (photos.length === 0) { toast.error(t.requests.photos_required); return false }
    }
    if (s === 'trajet') {
      if (!originCode || !destCode) { toast.error(t.carrier.airport_required); return false }
      if (!receiver || !deadline) { toast.error(t.validation.required); return false }
    }
    if (s === 'infos') {
      if (authMode === 'login') {
        if (!email || !password) { toast.error(t.validation.required); return false }
      } else {
        if (!firstName || !lastName || !email || !password) { toast.error(t.validation.required); return false }
        if (!cgu) { toast.error(t.auth.cgu_required); return false }
      }
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
      content_description: description,
      weight_kg: parseFloat(weightKg),
      budget_per_kg: mode === 'small' ? 0 : parseFloat(budgetPerKg),
      package_mode: mode,
      receiver_email_or_phone: receiver,
      deadline_date: deadline,
      photos,
    }
    const userInfo: GuestUserInfo | undefined = isVisitor
      ? { first_name: firstName, last_name: lastName, email, password, cgu_accepted: cgu }
      : undefined
    await submitPublish('request', payload, userInfo, authMode)
  }

  const grid2 = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 } as const
  const radioStyle = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer',
    color: active ? RED : CHARCOAL, fontSize: 13, fontWeight: active ? 600 : 500,
  } as const)
  const fieldLabel = { fontSize: 12, fontWeight: 500 as const, color: CHARCOAL, marginBottom: 6, display: 'flex', alignItems: 'center' } as const

  const currentStep = steps[step]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 380 }}>
      {/* Barre de progression */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
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

      {/* Contenu de l'etape */}
      <div style={{ flex: 1 }}>
        {currentStep === 'colis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ ...fieldLabel, marginBottom: 8 }}>
                {t.requests.form_title}<InfoTooltip text={t.publish.tip_mode} />
              </p>
              <div style={{ display: 'flex', gap: 20 }}>
                {(['kg', 'small'] as const).map(mo => (
                  <div key={mo} onClick={() => setMode(mo)} style={radioStyle(mode === mo)}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${mode === mo ? RED : TAUPE}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {mode === mo && <span style={{ width: 7, height: 7, borderRadius: '50%', background: RED }} />}
                    </span>
                    {mo === 'kg' ? t.booking.mode_kg : t.booking.mode_small}
                  </div>
                ))}
              </div>
            </div>
            <Input label={t.requests.field_content} required placeholder={t.requests.field_content_placeholder}
              value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
            <div style={grid2}>
              <Input label={t.requests.field_weight} required type="number" step="0.1" placeholder="3"
                value={weightKg} onChange={e => setWeightKg(e.target.value)} style={inputStyle} />
              {mode === 'kg' && (
                <Input label={t.requests.field_budget} required type="number" step="0.5" placeholder="5"
                  value={budgetPerKg} onChange={e => setBudgetPerKg(e.target.value)} style={inputStyle} />
              )}
            </div>
            {/* Photos */}
            <div>
              <p style={fieldLabel}>{t.requests.field_photos}<span style={{ color: RED }}> *</span></p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {photos.map((url, i) => (
                  <div key={i} style={{ position: 'relative', width: 64, height: 64 }}>
                    <img src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />
                    <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                      style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: RED, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={9} color={WHITE} />
                    </button>
                  </div>
                ))}
                {photos.length < 3 && (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    style={{ width: 64, height: 64, borderRadius: 8, border: `2px dashed ${FIELD_BORDER}`, background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    {uploading ? <span style={{ fontSize: 10, color: TAUPE }}>...</span> : <Upload size={16} color={TAUPE} />}
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => handleFiles(e.target.files)} />
            </div>
          </div>
        )}

        {currentStep === 'trajet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <Input label={t.requests.field_receiver} required placeholder="recepteur@email.com"
              value={receiver} onChange={e => setReceiver(e.target.value)} style={inputStyle} />
            <div>
              <p style={fieldLabel}>
                {t.requests.field_deadline}<span style={{ color: RED }}> *</span>
                <InfoTooltip text={t.publish.tip_deadline} />
              </p>
              <DatePicker label="" value={deadline} onChange={setDeadline} min={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
        )}

        {currentStep === 'infos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Toggle nouveau compte / compte existant */}
            <div style={{ display: 'flex', gap: 6, padding: 4, background: '#F2EFEA', borderRadius: 10 }}>
              {(['register', 'login'] as const).map(m => (
                <button key={m} type="button" onClick={() => setAuthMode(m)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: 'none', background: authMode === m ? WHITE : 'transparent', color: authMode === m ? CHARCOAL : TAUPE, fontSize: 13, fontWeight: authMode === m ? 600 : 500, cursor: 'pointer', boxShadow: authMode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                  {m === 'register' ? t.publish.auth_new : t.publish.auth_existing}
                </button>
              ))}
            </div>
            {authMode === 'register' && (
              <div style={grid2}>
                <Input label={t.auth.first_name} required value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
                <Input label={t.auth.last_name} required value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
              </div>
            )}
            <Input label={t.auth.email_label} type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            <Input label={t.auth.password_label} type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            {authMode === 'register' && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: TAUPE, cursor: 'pointer' }}>
                <input type="checkbox" checked={cgu} onChange={e => setCgu(e.target.checked)} style={{ marginTop: 2, accentColor: RED }} />
                <span>{t.auth.cgu_label}</span>
              </label>
            )}
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
            {submitting ? '...' : t.publish.publish_request_cta}
          </button>
        )}
      </div>
    </div>
  )
}