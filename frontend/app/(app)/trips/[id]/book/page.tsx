'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Upload, X, Scan, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from '@/hooks/useTranslation'
import { useBookingStore } from '@/stores/booking.store'
import { Button, Input } from '@/components/ui/kipar'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, GREEN } from '@/lib/theme'
import { useLimits } from '@/hooks/useLimits'
import { useInsuranceConfig, calculateInsurancePremium } from '@/hooks/useInsuranceConfig'
import { useAuthStore } from '@/stores/auth.store'
import { useKyc } from '@/hooks/useKyc'

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
  const { bookingsBlocked, limits } = useLimits()
  const { user } = useAuthStore()
  const kyc = useKyc()
  const { t } = useTranslation()
  const { selectedTrip, setCurrentBookingId } = useBookingStore()
  const insuranceConfig = useInsuranceConfig()

  const { data: tripData } = useQuery({
    queryKey: ['trip', id],
    queryFn: async () => {
      const res = await api.get(`/trips/${id}`)
      return res.data
    },
    enabled: !!id,
  })

  const trip = tripData || selectedTrip
  const hasKg = trip?.price_per_kg != null
  const hasSmall = trip?.small_package_price != null
  const [packageMode, setPackageMode] = useState<'kg' | 'small'>('kg')
  useEffect(() => {
    if (hasSmall && !hasKg) setPackageMode('small')
    else if (hasKg && !hasSmall) setPackageMode('kg')
  }, [hasKg, hasSmall])
  const [withInsurance, setWithInsurance] = useState(false)
  const [reminderHours, setReminderHours] = useState<number | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const [scanResult, setScanResult] = useState<any>(null)
  const [scanning, setScanning] = useState(false)
  const [scanQuota, setScanQuota] = useState<{ free_remaining: number } | null>(null)

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

  const loadScanQuota = async () => {
    try {
      const res = await api.get('/kiparscan/quota')
      setScanQuota({ free_remaining: res.data.free_remaining })
    } catch { /* silencieux */ }
  }
  if (typeof window !== 'undefined' && scanQuota === null) { loadScanQuota() }

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
        fd.append('upload_preset', 'kipar_package_photos')
        const res = await fetch('https://api.cloudinary.com/v1_1/dzlhxae2z/image/upload', { method: 'POST', body: fd })
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

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const weight = parseFloat(watch('weight_kg') || '0') || 0
  const value = parseFloat(watch('declared_value') || '0') || 0
  const pricePerKg = trip?.price_per_kg || 0
  const SMALL_PACKAGE_MAX_KG = 1.0
  const SMALL_PACKAGE_KIPAR_FEE = 5.0
  const isSmallPackage = packageMode === 'small'
  const weightModeError =
    weight > 0 && packageMode === 'kg' && weight < SMALL_PACKAGE_MAX_KG ? t.booking.weight_too_small_for_kg :
    weight > 0 && packageMode === 'small' && weight >= SMALL_PACKAGE_MAX_KG ? t.booking.weight_too_big_for_small :
    null
  const transport = isSmallPackage ? (trip?.small_package_price || 0) : weight * pricePerKg
  const senderFee = isSmallPackage ? SMALL_PACKAGE_KIPAR_FEE : transport * 0.15
  const hoursUntilDep = trip?.departure_date
    ? (new Date(trip.departure_date).getTime() - Date.now()) / 3600000
    : Infinity
  const isUrgentTrip = hoursUntilDep <= 36
  const canBookUrgent = trip?.accepts_urgent ?? false
  const bookingFlatFee = isSmallPackage ? 0 : (transport > 0 ? (isUrgentTrip && canBookUrgent ? 10.0 : 1.50) : 0)
  const commission = senderFee + bookingFlatFee
  const insurance = withInsurance ? calculateInsurancePremium(insuranceConfig, value) : 0
  const total = transport + commission + insurance

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await api.post('/bookings', { photos,
        trip_id: id,
        receiver_email_or_phone: data.receiver_email_or_phone,
        content_description: data.content_description,
        weight_kg: parseFloat(data.weight_kg),
        declared_value: parseFloat(data.declared_value || '0'),
        insurance_subscribed: withInsurance,
        reminder_hours: reminderHours,
      })
      return res.data
    },
    onSuccess: (data) => {
      setCurrentBookingId(data.id)
      router.push(`/trips/${id}/book/payment?booking_id=${data.id}&amount=${(transport + commission).toFixed(2)}&transport=${transport.toFixed(2)}&declared_value=${value}`)
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => e.message).join(' — ')
        : detail || t.errors.generic
      toast.error(msg)
    },
  })

  if (user && user.kyc_status !== 'approved') {
    return (
      <div style={{ minHeight: '100vh', background: 'rgba(240,237,232,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E1DC', borderRadius: 24, padding: '32px 24px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>🪪</p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1A', marginBottom: 8 }}>
            {t.onboarding.identity_title}
          </h2>
          <p style={{ fontSize: 13, color: '#7A736B', marginBottom: 20 }}>
            {t.onboarding.identity_subtitle}
          </p>

          {(kyc.isIdle || kyc.isError) && (
            <>
              <div style={{ textAlign: 'left', background: 'rgba(240,237,232,0.5)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>{t.onboarding.kyc_how_title}</p>
                {[t.onboarding.kyc_step1, t.onboarding.kyc_step2, t.onboarding.kyc_step3].map((step, i) => (
                  <p key={i} style={{ fontSize: 12, color: '#7A736B', marginBottom: 4 }}>{step}</p>
                ))}
                <p style={{ fontSize: 11, color: '#DC0029', marginTop: 8 }}>{t.onboarding.kyc_mobile_tip}</p>
              </div>
              {kyc.isError && (
                <p style={{ fontSize: 12, color: '#DC0029', marginBottom: 12 }}>{kyc.error}</p>
              )}
              <button
                onClick={kyc.startKyc}
                style={{ background: '#DC0029', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                {t.profile_edit.kyc_action_verify}
              </button>
            </>
          )}

          {(kyc.isStarted || kyc.isPolling) && (
            <div style={{ marginTop: 8 }}>
              <div style={{ width: 40, height: 40, border: '3px solid #DC0029', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>{t.onboarding.kyc_waiting}</p>
              <p style={{ fontSize: 12, color: '#7A736B' }}>{t.onboarding.kyc_waiting_sub}</p>
            </div>
          )}

          {kyc.isApproved && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>✅</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#16A34A', marginBottom: 4 }}>{t.onboarding.kyc_verified}</p>
              <p style={{ fontSize: 12, color: '#7A736B' }}>{t.onboarding.kyc_verified_sub}</p>
            </div>
          )}

          {kyc.isTimeout && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>{t.onboarding.kyc_timeout}</p>
              <p style={{ fontSize: 12, color: '#7A736B', marginBottom: 16 }}>{t.onboarding.kyc_timeout_sub}</p>
              <button
                onClick={kyc.reset}
                style={{ background: '#F5F2EE', color: '#1A1A1A', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {t.onboarding.kyc_check_btn}
              </button>
            </div>
          )}

        </div>
      </div>
    )
  }

  if (bookingsBlocked) {
    return (
      <div style={{ minHeight: '100vh', background: 'rgba(240,237,232,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 24, padding: '32px 24px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>🔒</p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#92400E', marginBottom: 8 }}>Limite atteinte</h2>
          <p style={{ fontSize: 14, color: '#92400E', marginBottom: 4 }}>
            {limits?.bookings.current}/{limits?.bookings.max} utilisés en gratuit
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
            {t.booking.title}
          </h1>
          {trip && (
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              {trip.origin_airport_code} → {trip.destination_airport_code}{trip.price_per_kg != null ? ` · ${trip.price_per_kg}€/kg` : ''}
            </p>
          )}
        </div>
      </HeroHeader>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))}
        style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}
        className="md:max-w-2xl md:mx-auto">

        {/* Récepteur */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            {t.booking.receiver_label}
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
        <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t.booking.content_label}
            </p>
            <button type="button" onClick={() => scanRef.current?.click()}
              disabled={scanning}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: scanning ? SAND : RED, color: WHITE, border: 'none', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: scanning ? 'not-allowed' : 'pointer', opacity: scanning ? 0.7 : 1 }}>
              <Scan size={13} />
              {scanning ? t.kiparscan.scanning : t.kiparscan.btn}
            </button>
            <input ref={scanRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => handleKiparScan(e.target.files)} />
          </div>
          {scanQuota !== null && !user?.is_premium && (
            <p style={{ fontSize: 11, color: scanQuota.free_remaining === 0 ? RED : TAUPE, marginTop: 6 }}>
              {scanQuota.free_remaining === 0
                ? t.premium.upgrade_kiparscan
                : `${scanQuota.free_remaining} scan${scanQuota.free_remaining > 1 ? 's' : ''} restant ce mois`}
            </p>
          )}
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
                { label: t.kiparscan.dimensions, value: scanResult.dimensions_estimate },
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
            <Input
              label={t.booking.content_label}
              placeholder={t.booking.content_placeholder}
              error={errors.content_description?.message}
              {...register('content_description')}
            />
            {hasKg && hasSmall && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <button type="button" onClick={() => setPackageMode('kg')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${packageMode === 'kg' ? RED : BORDER}`, background: packageMode === 'kg' ? 'rgba(220,0,41,0.05)' : WHITE, color: packageMode === 'kg' ? RED : CHARCOAL, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {t.booking.mode_kg}
                </button>
                <button type="button" onClick={() => setPackageMode('small')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${packageMode === 'small' ? RED : BORDER}`, background: packageMode === 'small' ? 'rgba(220,0,41,0.05)' : WHITE, color: packageMode === 'small' ? RED : CHARCOAL, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {t.booking.mode_small}
                </button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input
                label={t.booking.weight_label}
                type="number"
                placeholder={packageMode === 'small' ? '0.5' : '2.5'}
                step="0.1"
                min="0.1"
                max={packageMode === 'small' ? '0.99' : undefined}
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
            {weightModeError && (
              <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', marginTop: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#DC0029', margin: 0 }}>{weightModeError}</p>
              </div>
            )}
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 12px', marginTop: 10 }}>
              <p style={{ fontSize: 11, color: '#92400E', margin: 0, lineHeight: 1.5 }}>{t.booking.small_package_disclaimer}</p>
            </div>
          </div>
        </div>

        {/* Photos */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            {t.requests.field_photos}
          </p>
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
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ width: 80, height: 80, borderRadius: 10, border: '2px dashed ' + BORDER, background: SAND, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
                {uploading ? <span style={{ fontSize: 10, color: TAUPE }}>...</span> : <><Upload size={16} color={TAUPE} /><span style={{ fontSize: 10, color: TAUPE }}>+</span></>}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => handlePhotoUpload(e.target.files)} />
        </div>

        {/* Assurance */}
        {insuranceConfig.enabled && (
        <div
          style={{ background: WHITE, borderRadius: 16, padding: 16, border: `1px solid ${withInsurance ? RED : BORDER}`, cursor: 'pointer', transition: 'all 0.2s' }}
          onClick={() => setWithInsurance(!withInsurance)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>{t.booking.insurance_label}</p>
              <p style={{ fontSize: 12, color: TAUPE, marginTop: 2 }}>{t.booking.insurance_desc} · {insurance > 0 ? `+${insurance.toFixed(2)}€` : t.booking.insurance_enter_value}</p>
            </div>
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${withInsurance ? RED : BORDER}`, background: withInsurance ? RED : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              {withInsurance && <div style={{ width: 8, height: 8, borderRadius: '50%', background: WHITE }} />}
            </div>
          </div>
        </div>
        )}

        {/* Rappel livraison -- Premium only */}
        <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER, position: 'relative', overflow: 'hidden' }}>
          {!user?.is_premium && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'rgba(255,255,255,0.75)', borderRadius: 16, cursor: 'pointer' }}
              onClick={() => router.push('/premium')}>
              <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, fontWeight: 700, color: '#92400E', background: '#FFF3CD', border: '1px solid #FFE082', borderRadius: 99, padding: '3px 10px' }}>Premium</span>
            </div>
          )}
          <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, marginBottom: 4 }}>{t.booking.reminder_label}</p>
          <p style={{ fontSize: 12, color: TAUPE, marginBottom: 12 }}>{t.booking.reminder_desc}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([null, 2, 6, 12, 24] as (number | null)[]).map(h => (
              <button key={String(h)} type="button"
                onClick={() => user?.is_premium ? setReminderHours(h) : router.push('/premium')}
                style={{ padding: '7px 14px', borderRadius: 99, border: '1px solid ' + (reminderHours === h ? RED : BORDER), background: reminderHours === h ? 'rgba(220,0,41,0.06)' : WHITE, color: reminderHours === h ? RED : CHARCOAL, fontSize: 12, fontWeight: reminderHours === h ? 700 : 400, cursor: user?.is_premium ? 'pointer' : 'not-allowed' }}>
                {h === null ? t.booking.reminder_none : h === 2 ? t.booking.reminder_2h : h === 6 ? t.booking.reminder_6h : h === 12 ? t.booking.reminder_12h : t.booking.reminder_24h}
              </button>
            ))}
          </div>
        </div>

        {/* Récapitulatif */}
        <div style={{ background: SAND, borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            {t.booking.total}
          </p>
          {[
            { label: t.booking.transport_cost, value: transport > 0 ? `${transport.toFixed(2)}€` : '—' },
            { label: t.booking.commission, value: commission > 0 ? `${commission.toFixed(2)}€` : '—' },
            ...(withInsurance ? [{ label: t.booking.insurance_line, value: `${insurance.toFixed(2)}€` }] : []),
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: CHARCOAL2 }}>
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid ' + BORDER, paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: CHARCOAL }}>
            <span>{t.booking.total}</span>
            <span>{total > 0 ? `${total.toFixed(2)}€` : '—'}</span>
          </div>
        </div>

        {/* Banner urgence */}
    {isUrgentTrip && canBookUrgent && (
      <div style={{ background: '#FFF3CD', border: '1px solid #FFE082', borderRadius: 12, padding: '12px 14px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: '0 0 4px' }}>
          ⚡ {t.booking.urgent_notice_title ?? 'Colis urgent'}
        </p>
        <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
          {t.booking.urgent_notice_desc ?? 'Frais dossier urgence : 10€ (départ dans moins de 36h)'}
        </p>
      </div>
    )}
    {/* Banner trip non disponible */}
    {isUrgentTrip && !canBookUrgent && (
      <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 14px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#DC0029', margin: '0 0 4px' }}>
          {t.booking.urgent_unavailable_title ?? 'Trajet non disponible'}
        </p>
        <p style={{ fontSize: 12, color: '#DC0029', margin: 0 }}>
          {t.booking.urgent_unavailable_desc ?? 'Ce trajet ne peut plus être réservé (départ dans moins de 36h)'}
        </p>
      </div>
    )}
    {/* Validation kg */}
    {packageMode === 'kg' && weight > 0 && trip && trip.remaining_kg != null && weight > trip.remaining_kg && (
      <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#DC0029', margin: 0 }}>
          {t.booking.weight_exceeds_available ?? `Seulement ${trip.remaining_kg} kg disponibles`}
        </p>
      </div>
    )}
    {packageMode === 'kg' && weight > 0 && trip && trip.max_kg_per_package != null && weight > trip.max_kg_per_package && (
      <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#DC0029', margin: 0 }}>
          {t.booking.weight_exceeds_max ?? `Maximum ${trip.max_kg_per_package} kg par colis`}
        </p>
      </div>
    )}
    <Button type="submit" fullWidth size="lg" loading={mutation.isPending}
      disabled={!!weightModeError || (isUrgentTrip && !canBookUrgent) || (packageMode === 'kg' && weight > 0 && trip && trip.remaining_kg != null && trip.max_kg_per_package != null && (weight > trip.remaining_kg || weight > trip.max_kg_per_package))}>
      {t.booking.confirm_btn}
    </Button>
      </form>
    </div>
  )
}