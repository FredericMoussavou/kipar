'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Inbox, ChevronRight, Plane } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import HeroHeader from '@/components/layout/HeroHeader'
import HeroBackHeader from '@/components/layout/HeroBackHeader'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import Select from '@/components/ui/kipar/Select'
import api from '@/lib/api'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, RED, GREEN } from '@/lib/theme'
import { getTrustGradient } from '@/lib/trust'
import { WeightDisplay } from '@/components/ui/kipar/WeightDisplay'
import { PricePerWeightDisplay, formatPricePerWeight } from '@/components/ui/kipar/PricePerWeightDisplay'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { useState } from 'react'

export default function CarrierRequestsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user } = useAuthStore()
  const rates = useExchangeRates()
  const queryClient = useQueryClient()
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<string>('')

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['carrier-requests'],
    queryFn: async () => (await api.get('/requests')).data,
    enabled: !!user?.is_carrier,
  })

  const { data: myTrips = [] } = useQuery({
    queryKey: ['my-trips'],
    queryFn: async () => (await api.get('/trips?mine=true')).data,
    enabled: !!user?.is_carrier,
  })

  const applyMutation = useMutation({
    mutationFn: async ({ requestId, tripId }: { requestId: string; tripId: string }) =>
      (await api.post(`/requests/${requestId}/apply?trip_id=${tripId}`)).data,
    onSuccess: () => {
      toast.success(t.requests.apply_success)
      queryClient.invalidateQueries({ queryKey: ['carrier-requests'] })
      setApplyingId(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t.errors.generic)
      setApplyingId(null)
    },
  })

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      <HeroBackHeader
        imageUrl="https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&q=80"
        title={t.requests.carrier_requests}
        minHeight={160}
      />

      <div style={{ padding: '20px 16px 80px' }} className="md:max-w-2xl md:mx-auto">
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: 110, background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER }} />)}
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: SAND, marginBottom: 16 }}>
              <Inbox size={36} color={TAUPE} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.requests.no_carrier_requests}</p>
            <p style={{ fontSize: 13, color: TAUPE }}>{t.requests.no_carrier_requests_sub}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map((req: any) => {
              const score = Math.round(req.sender_trust_score || 50)
              const { gradient, color } = getTrustGradient(score)
              const isApplying = applyingId === req.id
              const alreadyApplied = req.has_applied === true

              return (
                <div key={req.id} onClick={() => { if (!applyingId) router.push(`/requests/${req.id}`) }} style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 18, fontWeight: 800, color: CHARCOAL }}>{req.origin_airport_code}</p>
                      <Plane size={14} color={TAUPE} />
                      <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 18, fontWeight: 800, color: CHARCOAL }}>{req.destination_airport_code}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: CHARCOAL }}><PricePerWeightDisplay price={req.budget_per_kg} currency='EUR' unit='kg' userCurrency={user?.currency} userUnit={user?.weight_unit as any} rates={rates ?? undefined} /> max</p>
                      <p style={{ fontSize: 11, color: TAUPE }}><WeightDisplay value={req.weight_kg} unit='kg' userUnit={user?.weight_unit as any} /></p>
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: CHARCOAL2, marginBottom: 6 }}>{req.content_description}</p>
                  <p style={{ fontSize: 11, color: TAUPE, marginBottom: 10 }}>{t.requests.deadline_label}: {req.deadline_date} · {t.requests.applications}: {req.applications_count}</p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: 1, height: 3, background: SAND, borderRadius: 99 }}>
                      <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: gradient, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 24 }}>{score}</span>
                    <Link href={`/profile/${req.sender_id}`} onClick={e => e.stopPropagation()}
                      style={{ fontSize: 11, color: TAUPE, textDecoration: 'none' }}>
                      {req.sender_first_name} {req.sender_last_name}
                    </Link>
                  </div>

                  {alreadyApplied ? (
                    <div style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.06)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: TAUPE, textAlign: 'center' }}>
                      {t.requests.already_applied}
                    </div>
                  ) : !isApplying ? (
                    <button onClick={e => { e.stopPropagation(); setApplyingId(req.id) }}
                      style={{ width: '100%', padding: '10px', background: RED, color: WHITE, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {t.requests.apply_btn}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <Select value={selectedTripId} onChange={e => setSelectedTripId(e.target.value)}
                        style={{ width: '100%' }}>
                        <option value="">-- {t.carrier.my_trips} --</option>
                        {myTrips.filter((trip: any) => trip.status === 'open').map((trip: any) => (
                          <option key={trip.id} value={trip.id}>
                            {trip.origin_airport_code} → {trip.destination_airport_code} · {trip.departure_date} · {(() => { const f = formatPricePerWeight(trip.price_per_kg, trip.currency ?? 'EUR', (trip.weight_unit ?? 'kg') as any, user?.currency, user?.weight_unit as any, rates ?? undefined); return f.converted ? `${f.native} ≃ ${f.converted}` : f.native })()}
                          </option>
                        ))}
                      </Select>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={e => { e.stopPropagation(); setApplyingId(null) }}
                          style={{ flex: 1, padding: '10px', background: 'transparent', color: TAUPE, border: '1px solid ' + BORDER, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          {t.profile_edit.cancel}
                        </button>
                        <button onClick={e => { e.stopPropagation(); if (selectedTripId) applyMutation.mutate({ requestId: req.id, tripId: selectedTripId }) }}
                          disabled={!selectedTripId || applyMutation.isPending}
                          style={{ flex: 2, padding: '10px', background: selectedTripId ? RED : TAUPE, color: WHITE, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: selectedTripId ? 'pointer' : 'not-allowed' }}>
                          {applyMutation.isPending ? '...' : t.requests.apply_btn}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
