'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Inbox, ChevronRight, Plane } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import HeroHeader from '@/components/layout/HeroHeader'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import api from '@/lib/api'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, RED, GREEN } from '@/lib/theme'
import { getTrustGradient } from '@/lib/trust'
import { useState } from 'react'

export default function CarrierRequestsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user } = useAuthStore()
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
      <HeroHeader imageUrl="https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&q=80" minHeight={160}>
        <div style={{ padding: '48px 24px 28px', position: 'relative' }}>
          <button onClick={() => router.back()}
            style={{ position: 'absolute', top: 48, left: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={16} color="#fff" />
          </button>
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, color: '#fff', textAlign: 'center' }}>{t.requests.carrier_requests}</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 4 }}>{requests.length} {t.requests.status_open.toLowerCase()}</p>
        </div>
      </HeroHeader>

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
                <div key={req.id} style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 18, fontWeight: 800, color: CHARCOAL }}>{req.origin_airport_code}</p>
                      <Plane size={14} color={TAUPE} />
                      <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 18, fontWeight: 800, color: CHARCOAL }}>{req.destination_airport_code}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: RED }}>{req.budget_per_kg}€/kg max</p>
                      <p style={{ fontSize: 11, color: TAUPE }}>{req.weight_kg} kg</p>
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: CHARCOAL2, marginBottom: 6 }}>{req.content_description}</p>
                  <p style={{ fontSize: 11, color: TAUPE, marginBottom: 10 }}>{t.requests.deadline_label}: {req.deadline_date} · {t.requests.applications}: {req.applications_count}</p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: 1, height: 3, background: SAND, borderRadius: 99 }}>
                      <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: gradient, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 24 }}>{score}</span>
                    <span style={{ fontSize: 11, color: TAUPE }}>{req.sender_first_name} {req.sender_last_name}</span>
                  </div>

                  {alreadyApplied ? (
                    <div style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.06)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: TAUPE, textAlign: 'center' }}>
                      {t.requests.already_applied}
                    </div>
                  ) : !isApplying ? (
                    <button onClick={() => setApplyingId(req.id)}
                      style={{ width: '100%', padding: '10px', background: RED, color: WHITE, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {t.requests.apply_btn}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <select value={selectedTripId} onChange={e => setSelectedTripId(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + BORDER, borderRadius: 10, fontSize: 13, color: CHARCOAL, background: WHITE, outline: 'none' }}>
                        <option value="">-- {t.carrier.my_trips} --</option>
                        {myTrips.filter((trip: any) => trip.status === 'open').map((trip: any) => (
                          <option key={trip.id} value={trip.id}>
                            {trip.origin_airport_code} → {trip.destination_airport_code} · {trip.departure_date} · {trip.price_per_kg}€/kg
                          </option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setApplyingId(null)}
                          style={{ flex: 1, padding: '10px', background: 'transparent', color: TAUPE, border: '1px solid ' + BORDER, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          {t.profile_edit.cancel}
                        </button>
                        <button onClick={() => { if (selectedTripId) applyMutation.mutate({ requestId: req.id, tripId: selectedTripId }) }}
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
