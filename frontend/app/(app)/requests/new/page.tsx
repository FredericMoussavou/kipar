'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { usePersistedForm } from '@/hooks/usePersistedForm'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Search, X, Upload, Image as ImageIcon, Scan, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { Button, Input } from '@/components/ui/kipar'
import DatePicker from '@/components/ui/kipar/DatePicker'
import AirportInput from '@/components/trips/AirportInput'
import HeroHeader from '@/components/layout/HeroHeader'
import HeroBackHeader from '@/components/layout/HeroBackHeader'
import api from '@/lib/api'
import { extractApiError } from '@/lib/apiError'
import { RED, TAUPE, BORDER, CHARCOAL, SAND, WHITE, GREEN } from '@/lib/theme'
import { useLimits } from '@/hooks/useLimits'
import { useConfig } from '@/hooks/useConfig'
import { useAuthStore } from '@/stores/auth.store'
import { toKg, unitLabel, WeightUnit } from '@/lib/weight'

const CLOUDINARY_CLOUD = 'dzlhxae2z'
const CLOUDINARY_PRESET = 'kipar_package_photos'

const makeSchema = (t: any) => z.object({
  origin_city: z.string().min(2, t.validation.required),
  origin_airport_code: z.string().length(3, t.validation.iata_code),
  destination_city: z.string().min(2, t.validation.required),
  destination_airport_code: z.string().length(3, t.validation.iata_code),
  content_description: z.string().min(3, t.validation.required),
  weight_kg: z.string().min(1, t.validation.required),
  declared_value: z.string().optional().refine(v => !v || parseFloat(v) >= 0, { message: t.validation.required }),
  budget_per_kg: z.string().min(1, t.validation.required),
  receiver_email_or_phone: z.string().min(3, t.validation.required),
  deadline_date: z.string().min(1, t.validation.required),
})

type FormData = z.infer<ReturnType<typeof makeSchema>>

export default function NewRequestPage() {
  const { t } = useTranslation()
  const schema = useMemo(() => makeSchema(t), [t])
  const router = useRouter()
  const { requestsBlocked, limits } = useLimits()
  const { user } = useAuthStore()
  const weightUnit = (user?.weight_unit ?? 'kg') as WeightUnit
  const [originInput, setOriginInput] = useState('')
  const [destInput, setDestInput] = useState('')
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([])
  const [destSuggestions, setDestSuggestions] = useState<any[]>([])
  const [originSelected, setOriginSelected] = useState(false)
  const [destSelected, setDestSelected] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const config = useConfig()
  const SMALL_PACKAGE_MAX_KG = config.small_package.max_kg
  const [packageMode, setPackageMode] = useState<'kg' | 'small'>('kg')
  const modeInit = useRef(false)
  useEffect(() => {
    if (!modeInit.current) { modeInit.current = true; return }
    setValue('budget_per_kg', packageMode === 'small' ? '0' : '')
    setValue('weight_kg', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageMode])

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Persistance du formulaire (sessionStorage)
  const { clear: clearPersist } = usePersistedForm(
    'kipar_form_newrequest',
    {
      content_description: watch('content_description'),
      weight_kg: watch('weight_kg'),
      declared_value: watch('declared_value'),
      budget_per_kg: watch('budget_per_kg'),
      receiver_email_or_phone: watch('receiver_email_or_phone'),
      originInput, destInput, photos,
    },
    (s: any) => {
      reset({
        content_description: s.content_description,
        weight_kg: s.weight_kg,
        declared_value: s.declared_value,
        budget_per_kg: s.budget_per_kg,
        receiver_email_or_phone: s.receiver_email_or_phone,
      })
      if (s.originInput) setOriginInput(s.originInput)
      if (s.destInput) setDestInput(s.destInput)
      if (Array.isArray(s.photos)) setPhotos(s.photos)
    },
  )
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const [scanResult, setScanResult] = useState<any>(null)
  const [scanning, setScanning] = useState(false)
  const [scanQuota, setScanQuota] = useState<{ free_remaining: number } | null>(null)
  const [deadlineDate, setDeadlineDate] = useState('')


  const searchAirports = async (q: string, setSuggestions: (s: any[]) => void) => {
    if (q.length < 1) { setSuggestions([]); return }
    try {
      const res = await api.get('/airports?q=' + encodeURIComponent(q) + '&limit=6', { headers: {} })
      setSuggestions(res.data?.results || [])
    } catch { setSuggestions([]) }
  }

  const loadScanQuota = async () => {
    try {
      const res = await api.get('/kiparscan/quota')
      setScanQuota({ free_remaining: res.data.free_remaining })
    } catch { /* silencieux */ }
  }
  if (typeof window !== 'undefined' && scanQuota === null) { loadScanQuota() }

  const handleKiparScan = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setScanning(true)
    setScanResult(null)
    try {
      const fd = new FormData()
      fd.append('file', files[0])
      const res = await api.post('/kiparscan/analyze', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setScanResult(res.data)
    } catch {
      toast.error(t.kiparscan.error)
    } finally {
      setScanning(false)
    }
  }

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files) return
    const remaining = 3 - photos.length
    const toUpload = Array.from(files).slice(0, remaining)
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of toUpload) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('upload_preset', CLOUDINARY_PRESET)
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
          method: 'POST',
          body: fd,
        })
        const data = await res.json()
        if (data.secure_url) urls.push(data.secure_url)
      }
      setPhotos(prev => [...prev, ...urls].slice(0, 3))
    } catch {
      toast.error(t.errors.generic)
    } finally {
      setUploading(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    try {
      if (photos.length === 0) {
        toast.error(t.requests.photos_required)
        return
      }
      if (packageMode === 'small' && toKg(parseFloat(data.weight_kg), weightUnit) >= SMALL_PACKAGE_MAX_KG) {
        toast.error(t.booking.weight_too_big_for_small)
        return
      }
      const res = await api.post('/requests', {
        origin_city: data.origin_city,
        origin_airport_code: data.origin_airport_code,
        destination_city: data.destination_city,
        destination_airport_code: data.destination_airport_code,
        content_description: data.content_description,
        weight_kg: toKg(parseFloat(data.weight_kg), weightUnit),
        declared_value: data.declared_value ? parseFloat(data.declared_value) : null,
        budget_per_kg: packageMode === 'small' ? 0 : parseFloat(data.budget_per_kg),
        package_mode: packageMode,
        receiver_email_or_phone: data.receiver_email_or_phone,
        deadline_date: data.deadline_date,
        photos,
      })
      toast.success(t.requests.success_created)
      clearPersist()
      router.push(`/requests/${res.data.id}`)
    } catch (err: any) {
      toast.error(extractApiError(err, t.errors.generic))
    }
  }

  const sectionStyle = {
    background: WHITE,
    borderRadius: 16,
    padding: 16,
    border: '1px solid ' + BORDER,
    marginBottom: 12,
  }
  const labelStyle = {
    fontSize: 11,
    fontWeight: 600 as const,
    color: TAUPE,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: 12,
  }

  if (requestsBlocked) {
    return (
      <div style={{ minHeight: '100vh', background: 'rgba(240,237,232,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 24, padding: '32px 24px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>🔒</p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#92400E', marginBottom: 8 }}>{t.carrier.limit_reached_title}</h2>
          <p style={{ fontSize: 14, color: '#92400E', marginBottom: 4 }}>
            {limits?.requests.current}/{limits?.requests.max} utilisés en gratuit
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
        imageUrl="https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&q=80"
        title={t.requests.form_title}
        minHeight={160}
        gradient="vertical"
      />

      <form onSubmit={handleSubmit(onSubmit)}
        style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}
        className="md:max-w-2xl md:mx-auto">

        {/* Départ */}
        <div style={sectionStyle}>
          <AirportInput
            light
            required
            label={t.carrier.section_departure}
            placeholder={t.search.origin_placeholder}
            value={originInput}
            onChange={(v) => { setOriginInput(v); setOriginSelected(false); searchAirports(v, setOriginSuggestions) }}
            onSelect={(a: any) => {
              setOriginInput(`${a.code} — ${a.name}`)
              setValue('origin_airport_code', a.code)
              setValue('origin_city', a.city || a.name)
              setOriginSuggestions([])
              setOriginSelected(true)
            }}
            onClear={() => { setOriginInput(''); setOriginSuggestions([]); setOriginSelected(false) }}
            suggestions={originSuggestions}
          />
        </div>

        {/* Destination */}
        <div style={sectionStyle}>
          <AirportInput
            light
            required
            label={t.carrier.section_destination}
            placeholder={t.search.dest_placeholder}
            value={destInput}
            onChange={(v) => { setDestInput(v); setDestSelected(false); searchAirports(v, setDestSuggestions) }}
            onSelect={(a: any) => {
              setDestInput(`${a.code} — ${a.name}`)
              setValue('destination_airport_code', a.code)
              setValue('destination_city', a.city || a.name)
              setDestSuggestions([])
              setDestSelected(true)
            }}
            onClear={() => { setDestInput(''); setDestSuggestions([]); setDestSelected(false) }}
            suggestions={destSuggestions}
          />
        </div>

        {/* Colis */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={labelStyle}>{t.package_detail.section_package}</p>
            <button type="button" onClick={() => scanRef.current?.click()}
              disabled={scanning}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: scanning ? SAND : RED, color: WHITE, border: 'none', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: scanning ? 'not-allowed' : 'pointer', opacity: scanning ? 0.7 : 1 }}>
              <Scan size={13} />
              {scanning ? t.kiparscan.scanning : t.kiparscan.btn}
            </button>
            <input ref={scanRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => handleKiparScan(e.target.files)} />
            {scanQuota !== null && !user?.is_premium && (
              <p style={{ fontSize: 11, color: scanQuota.free_remaining === 0 ? "#DC0029" : "#B5AFAB", marginTop: 4 }}>
                {scanQuota.free_remaining === 0 ? t.premium.upgrade_kiparscan : scanQuota.free_remaining + " scan restant ce mois"}
              </p>
            )}
          </div>
          {scanResult && (
            <div style={{ background: scanResult.prohibited_flag ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${scanResult.prohibited_flag ? '#FCA5A5' : '#86EFAC'}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                {scanResult.prohibited_flag
                  ? <AlertTriangle size={14} color="#DC2626" />
                  : <CheckCircle size={14} color="#16A34A" />}
                <p style={{ fontSize: 12, fontWeight: 700, color: scanResult.prohibited_flag ? '#DC2626' : '#16A34A' }}>
                  {t.kiparscan.result_title}
                  {scanResult.simulated && <span style={{ fontWeight: 400, marginLeft: 6 }}>({t.kiparscan.simulated})</span>}
                </p>
              </div>
              {[
                { label: t.kiparscan.description, value: scanResult.content_description },
                { label: t.kiparscan.weight, value: scanResult.estimated_weight_kg ? `${scanResult.estimated_weight_kg} kg` : null },
                { label: t.kiparscan.confidence, value: scanResult.confidence === 'high' ? t.kiparscan.confidence_high : scanResult.confidence === 'medium' ? t.kiparscan.confidence_medium : t.kiparscan.confidence_low },
                ...(scanResult.prohibited_flag ? [{ label: t.kiparscan.prohibited_reason, value: scanResult.prohibited_reason }] : []),
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: CHARCOAL, marginBottom: 4 }}>
                  <span style={{ color: TAUPE }}>{label}</span>
                  <span style={{ fontWeight: 600, maxWidth: '60%', textAlign: 'right' }}>{value}</span>
                </div>
              ))}
              {!scanResult.prohibited_flag && (
                <button type="button"
                  onClick={() => {
                    if (scanResult.content_description) setValue('content_description', scanResult.content_description)
                    if (scanResult.estimated_weight_kg) setValue('weight_kg', String(scanResult.estimated_weight_kg))
                  }}
                  style={{ marginTop: 8, width: '100%', padding: '8px', background: '#16A34A', color: WHITE, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {t.kiparscan.apply_btn}
                </button>
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input label={t.requests.field_content} required placeholder={t.requests.field_content_placeholder}
              error={errors.content_description?.message} {...register('content_description')} />
            <div style={{ display: 'flex', gap: 8 }}>
              {(['kg', 'small'] as const).map(m => (
                <button key={m} type="button" onClick={() => setPackageMode(m)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid ' + (packageMode === m ? RED : BORDER),
                    background: packageMode === m ? RED : WHITE, color: packageMode === m ? WHITE : CHARCOAL }}>
                  {m === 'kg' ? t.booking.mode_kg : t.booking.mode_small}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label={`${t.requests.field_weight} (${unitLabel(weightUnit)})`} required type="number" placeholder="3" step="0.1" min="0.1" max={packageMode === 'small' ? String(SMALL_PACKAGE_MAX_KG - 0.01) : undefined}
                error={errors.weight_kg?.message} {...register('weight_kg')} />
              <Input label={t.requests.field_value} type="number" placeholder="100" min="0"
                {...register('declared_value')} />
            </div>
            <Input label={t.requests.field_budget} required type="number" placeholder="5" step="0.5" min="0.5"
              error={errors.budget_per_kg?.message} {...register('budget_per_kg')}
              readOnly={packageMode === 'small'}
              style={packageMode === 'small' ? { background: SAND, color: TAUPE, cursor: 'not-allowed' } : undefined} />
          </div>
        </div>

        {/* Photos */}
        <div style={sectionStyle}>
          <p style={labelStyle}>{t.requests.field_photos}<span style={{ color: RED }}> *</span></p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photos.map((url, i) => (
              <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                <img src={url} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10 }} />
                <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: RED, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={10} color={WHITE} />
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <button type="button" onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ width: 80, height: 80, borderRadius: 10, border: '2px dashed ' + BORDER, background: SAND, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
                {uploading ? <span style={{ fontSize: 10, color: TAUPE }}>...</span> : <>
                  <Upload size={16} color={TAUPE} />
                  <span style={{ fontSize: 10, color: TAUPE }}>+</span>
                </>}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => handlePhotoUpload(e.target.files)} />
        </div>

        {/* Récepteur + deadline */}
        <div style={sectionStyle}>
          <p style={labelStyle}>{t.booking.receiver_label}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input label={t.requests.field_receiver} required placeholder={t.booking.receiver_placeholder}
              error={errors.receiver_email_or_phone?.message} {...register('receiver_email_or_phone')} />
            <DatePicker label={t.requests.field_deadline} required value={deadlineDate}
              onChange={v => { setDeadlineDate(v); setValue('deadline_date', v) }}
              error={errors.deadline_date?.message} min={new Date().toISOString().slice(0,10)} />
          </div>
        </div>

        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          {t.requests.submit_btn}
        </Button>
      </form>
    </div>
  )
}
