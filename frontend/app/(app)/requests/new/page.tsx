'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Search, X, Upload, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { Button, Input } from '@/components/ui/kipar'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { RED, TAUPE, BORDER, CHARCOAL, SAND, WHITE, GREEN } from '@/lib/theme'

const CLOUDINARY_CLOUD = 'dzlhxae2z'
const CLOUDINARY_PRESET = 'kipar_package_photos'

const schema = z.object({
  origin_city: z.string().min(2, 'Requis'),
  origin_airport_code: z.string().length(3, '3 lettres'),
  destination_city: z.string().min(2, 'Requis'),
  destination_airport_code: z.string().length(3, '3 lettres'),
  content_description: z.string().min(3, 'Requis'),
  weight_kg: z.string().min(1, 'Requis'),
  declared_value: z.string().optional(),
  budget_per_kg: z.string().min(1, 'Requis'),
  receiver_email_or_phone: z.string().min(3, 'Requis'),
  deadline_date: z.string().min(1, 'Requis'),
})

type FormData = z.infer<typeof schema>

export default function NewRequestPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [originInput, setOriginInput] = useState('')
  const [destInput, setDestInput] = useState('')
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([])
  const [destSuggestions, setDestSuggestions] = useState<any[]>([])
  const [originSelected, setOriginSelected] = useState(false)
  const [destSelected, setDestSelected] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const searchAirports = async (q: string, setSuggestions: (s: any[]) => void) => {
    if (q.length < 1) { setSuggestions([]); return }
    try {
      const res = await api.get('/airports?q=' + encodeURIComponent(q) + '&limit=6', { headers: {} })
      setSuggestions(res.data?.results || [])
    } catch { setSuggestions([]) }
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
      const res = await api.post('/requests', {
        origin_city: data.origin_city,
        origin_airport_code: data.origin_airport_code,
        destination_city: data.destination_city,
        destination_airport_code: data.destination_airport_code,
        content_description: data.content_description,
        weight_kg: parseFloat(data.weight_kg),
        declared_value: data.declared_value ? parseFloat(data.declared_value) : null,
        budget_per_kg: parseFloat(data.budget_per_kg),
        receiver_email_or_phone: data.receiver_email_or_phone,
        deadline_date: data.deadline_date,
        photos,
      })
      toast.success(t.requests.success_created)
      router.push(`/requests/${res.data.id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t.errors.generic)
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

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&q=80"
        minHeight={160}
        gradient="vertical"
      >
        <div style={{ padding: '48px 20px 24px', position: 'relative' }}>
          <button onClick={() => router.back()}
            style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={16} color="#fff" />
          </button>
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
            {t.requests.form_title}
          </h1>
        </div>
      </HeroHeader>

      <form onSubmit={handleSubmit(onSubmit)}
        style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}
        className="md:max-w-2xl md:mx-auto">

        {/* Départ */}
        <div style={sectionStyle}>
          <p style={labelStyle}>{t.carrier.section_departure}</p>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Search size={14} color={TAUPE} />
              <input
                value={originInput}
                onChange={e => { setOriginInput(e.target.value); setOriginSelected(false); searchAirports(e.target.value, setOriginSuggestions) }}
                placeholder="CDG, Paris..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: CHARCOAL, background: 'transparent' }}
              />
              {originSelected && <span style={{ fontSize: 11, color: GREEN }}>{t.carrier.airport_selected}</span>}
            </div>
            {originSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: WHITE, border: '1px solid ' + BORDER, borderRadius: 12, zIndex: 10, marginTop: 4 }}>
                {originSuggestions.map((a: any) => (
                  <div key={a.code} onClick={() => {
                    setOriginInput(`${a.code} — ${a.name}`)
                    setValue('origin_airport_code', a.code)
                    setValue('origin_city', a.city || a.name)
                    setOriginSuggestions([])
                    setOriginSelected(true)
                  }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: CHARCOAL, borderBottom: '1px solid ' + BORDER }}>
                    <span style={{ fontWeight: 700 }}>{a.code}</span> — {a.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Destination */}
        <div style={sectionStyle}>
          <p style={labelStyle}>{t.carrier.section_destination}</p>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Search size={14} color={TAUPE} />
              <input
                value={destInput}
                onChange={e => { setDestInput(e.target.value); setDestSelected(false); searchAirports(e.target.value, setDestSuggestions) }}
                placeholder="DSS, Dakar..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: CHARCOAL, background: 'transparent' }}
              />
              {destSelected && <span style={{ fontSize: 11, color: GREEN }}>{t.carrier.airport_selected}</span>}
            </div>
            {destSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: WHITE, border: '1px solid ' + BORDER, borderRadius: 12, zIndex: 10, marginTop: 4 }}>
                {destSuggestions.map((a: any) => (
                  <div key={a.code} onClick={() => {
                    setDestInput(`${a.code} — ${a.name}`)
                    setValue('destination_airport_code', a.code)
                    setValue('destination_city', a.city || a.name)
                    setDestSuggestions([])
                    setDestSelected(true)
                  }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: CHARCOAL, borderBottom: '1px solid ' + BORDER }}>
                    <span style={{ fontWeight: 700 }}>{a.code}</span> — {a.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colis */}
        <div style={sectionStyle}>
          <p style={labelStyle}>{t.package_detail.section_package}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input label={t.requests.field_content} placeholder={t.requests.field_content_placeholder}
              error={errors.content_description?.message} {...register('content_description')} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label={t.requests.field_weight} type="number" placeholder="3" step="0.1"
                error={errors.weight_kg?.message} {...register('weight_kg')} />
              <Input label={t.requests.field_value} type="number" placeholder="100"
                {...register('declared_value')} />
            </div>
            <Input label={t.requests.field_budget} type="number" placeholder="5" step="0.5"
              error={errors.budget_per_kg?.message} {...register('budget_per_kg')} />
          </div>
        </div>

        {/* Photos */}
        <div style={sectionStyle}>
          <p style={labelStyle}>{t.requests.field_photos}</p>
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
            <Input label={t.requests.field_receiver} placeholder={t.booking.receiver_placeholder}
              error={errors.receiver_email_or_phone?.message} {...register('receiver_email_or_phone')} />
            <Input label={t.requests.field_deadline} type="date"
              error={errors.deadline_date?.message} {...register('deadline_date')} />
          </div>
        </div>

        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          {t.requests.submit_btn}
        </Button>
      </form>
    </div>
  )
}
