'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plane, User, Check, Trash2, Package, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import { WeightDisplay } from '@/components/ui/kipar/WeightDisplay'
import { PricePerWeightDisplay } from '@/components/ui/kipar/PricePerWeightDisplay'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import HeroHeader from '@/components/layout/HeroHeader'
import Modal from '@/components/ui/kipar/Modal'
import api from '@/lib/api'
import { CHARCOAL, TAUPE, SAND, BORDER, WHITE, RED, GREEN, AMBER } from '@/lib/theme'
import { getTrustGradient } from '@/lib/trust'
import { useState } from 'react'

export default function RequestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const rates = useExchangeRates()
  const queryClient = useQueryClient()
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data: req, isLoading: loadingReq } = useQuery({
    queryKey: ['request', id],
    queryFn: async () => (await api.get(`/requests/${id}`)).data,
  })

  const { data: applications = [], isLoading: loadingApps } = useQuery({
    queryKey: ['request-applications', id],
    queryFn: async () => (await api.get(`/requests/${id}/applications`)).data,
    enabled: !!req && req.sender_id === user?.id,
  })

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/requests/${id}`)
      toast.success(t.requests.deleted)
      setToDelete(false)
      router.replace('/packages')
    } catch { toast.error(t.errors.generic) }
    finally { setDeleting(false) }
  }

  const acceptMutation = useMutation({
    mutationFn: async (appId: string) => (await api.post(`/requests/${id}/applications/${appId}/accept`)).data,
    onSuccess: (data) => {
      toast.success(t.requests.accepted)
      queryClient.invalidateQueries({ queryKey: ['request', id] })
      router.push(`/trips/${data.trip_id}/book/payment?booking_id=${data.booking_id}`)
    },
    onError: () => toast.error(t.errors.generic),
  })

  const isSender = user?.id === req?.sender_id
  const S = { background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, marginBottom: 12 }
  const L = { fontSize: 11, fontWeight: 600 as const, color: TAUPE, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12 }

  if (loadingReq) return <div style={{ padding: 80, textAlign: 'center', color: TAUPE }}>{t.profile_public.loading}</div>
  if (!req) return <div style={{ padding: 80, textAlign: 'center', color: TAUPE }}>{t.package_detail.not_found}</div>

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      <HeroHeader imageUrl="https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&q=80" minHeight={180} gradient="vertical">
        <div style={{ padding: '48px 20px 24px', position: 'relative' }}>
          <button onClick={() => router.back()} style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={16} color="#fff" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
            <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 28, fontWeight: 800, color: '#fff' }}>{req.origin_airport_code}</p>
            <Plane size={20} color="rgba(255,255,255,0.6)" />
            <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 28, fontWeight: 800, color: '#fff' }}>{req.destination_airport_code}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
            <StatusBadge status={req.status} />
            {isSender && (
              <button onClick={() => setToDelete(true)}
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Trash2 size={14} color="#fff" />
              </button>
            )}
          </div>
        </div>
      </HeroHeader>

      <div style={{ padding: '16px 16px 80px' }} className="md:max-w-2xl md:mx-auto">

        <div style={S}>
          <p style={L}>{t.package_detail.section_package}</p>
          {(() => {
            const isSmall = req.package_mode === 'small'
            const Icon = isSmall ? Mail : Package
            return (
              <span data-testid="packageModeBadge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                marginTop: 6, marginBottom: 16, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: SAND,
                color: CHARCOAL,
                border: '1px solid ' + BORDER }}>
                <Icon size={14} />
                {isSmall ? t.booking.mode_small : t.booking.mode_kg}
              </span>
            )
          })()}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: t.package_detail.field_content, value: req.content_description },
              { label: t.package_detail.field_weight, value: <WeightDisplay value={req.weight_kg} unit='kg' userUnit={user?.weight_unit as any} /> },
              req.package_mode === 'small'
                ? { label: t.booking.mode_small, value: t.booking.small_package_forfait }
                : { label: t.requests.budget_label, value: <PricePerWeightDisplay price={req.budget_per_kg} currency='EUR' unit='kg' userCurrency={user?.currency} userUnit={user?.weight_unit as any} rates={rates ?? undefined} /> },
              { label: t.requests.deadline_label, value: req.deadline_date },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 6, borderBottom: '1px solid ' + SAND }}>
                <span style={{ color: TAUPE }}>{label}</span>
                <span style={{ fontWeight: 500, color: CHARCOAL }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {req.photos?.length > 0 && (
          <div style={S}>
            <p style={L}>{t.requests.field_photos}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {req.photos.map((url: string, i: number) => (
                <img key={i} src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10 }} />
              ))}
            </div>
          </div>
        )}

        {isSender && (
          <div style={S}>
            <p style={L}>{t.requests.applications} ({applications.length})</p>
            {loadingApps ? (
              <div style={{ height: 60, background: SAND, borderRadius: 10 }} />
            ) : applications.length === 0 ? (
              <p style={{ fontSize: 13, color: TAUPE, textAlign: 'center', padding: '20px 0' }}>{t.requests.no_applications}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {applications.map((app: any) => {
                  const score = Math.round(app.carrier_trust_score || 50)
                  const { gradient, color } = getTrustGradient(score)
                  return (
                    <div key={app.id} style={{ background: SAND, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: CHARCOAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User size={18} color={WHITE} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL }}>{app.carrier_first_name} {app.carrier_last_name}</p>
                        <p style={{ fontSize: 11, color: TAUPE }}>{app.trip_departure_date} · <PricePerWeightDisplay price={app.trip_price_per_kg} currency={app.trip_currency ?? 'EUR'} unit={(app.trip_weight_unit ?? 'kg') as any} userCurrency={user?.currency} userUnit={user?.weight_unit as any} rates={rates ?? undefined} /> {app.trip_flight_number ? `· ${app.trip_flight_number}` : ''}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <div style={{ flex: 1, height: 3, background: BORDER, borderRadius: 99 }}>
                            <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: gradient, borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color }}>{score}</span>
                        </div>
                      </div>
                      {app.status === 'accepted' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: GREEN, fontWeight: 600 }}>
                          <Check size={14} /> {t.requests.accepted}
                        </div>
                      ) : app.status === 'pending' && req.status === 'open' ? (
                        <button
                          onClick={() => { setAcceptingId(app.id); acceptMutation.mutate(app.id) }}
                          disabled={acceptMutation.isPending}
                          style={{ padding: '8px 14px', background: RED, color: WHITE, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: acceptMutation.isPending && acceptingId === app.id ? 0.5 : 1 }}>
                          {t.requests.accept_btn}
                        </button>
                      ) : (
                        <StatusBadge status={app.status} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={toDelete} onClose={() => setToDelete(false)} title={t.requests.delete_confirm}>
        <p style={{ fontSize: 13, color: TAUPE, marginBottom: 20 }}>{req?.origin_airport_code} → {req?.destination_airport_code}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setToDelete(false)} disabled={deleting}
            style={{ padding: '10px 20px', background: 'transparent', color: TAUPE, border: '1px solid ' + BORDER, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {t.profile_edit.cancel}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            style={{ padding: '10px 20px', background: RED, color: WHITE, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.5 : 1, minWidth: 100 }}>
            {deleting ? '...' : t.profile_edit.delete_confirm}
          </button>
        </div>
      </Modal>
    </div>
  )
}
