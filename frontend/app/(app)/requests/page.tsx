'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Inbox, ChevronRight, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import HeroHeader from '@/components/layout/HeroHeader'
import Modal from '@/components/ui/kipar/Modal'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import api from '@/lib/api'
import { CHARCOAL, TAUPE, SAND, BORDER, WHITE, RED } from '@/lib/theme'
import { useState } from 'react'

export default function RequestsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my-requests'],
    queryFn: async () => (await api.get('/requests/mine')).data,
    enabled: !!user,
  })

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api.delete(`/requests/${toDelete.id}`)
      toast.success(t.requests.deleted)
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
      setToDelete(null)
    } catch { toast.error(t.errors.generic) }
    finally { setDeleting(false) }
  }

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      <HeroHeader imageUrl="https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&q=80" minHeight={160}>
        <div style={{ padding: '48px 24px 28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{t.requests.my_requests}</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{requests.length} {requests.length > 1 ? t.packages.booking_count_many.replace('{n}', '') : ''}</p>
          </div>
          <button onClick={() => router.push('/requests/new')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> {t.requests.new_request}
          </button>
        </div>
      </HeroHeader>

      <div style={{ padding: '20px 16px 80px' }} className="md:max-w-2xl md:mx-auto">
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: 90, background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER }} />)}
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: SAND, marginBottom: 16 }}>
              <Inbox size={36} color={TAUPE} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.requests.empty}</p>
            <p style={{ fontSize: 13, color: TAUPE, marginBottom: 20 }}>{t.requests.empty_sub}</p>
            <button onClick={() => router.push('/requests/new')}
              style={{ padding: '12px 24px', background: RED, color: WHITE, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {t.requests.post_btn}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {requests.map((req: any) => (
              <div key={req.id}
                onClick={() => router.push(`/requests/${req.id}`)}
                style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(220,0,41,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <p style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 16, fontWeight: 800, color: CHARCOAL }}>
                      {req.origin_airport_code} → {req.destination_airport_code}
                    </p>
                    <StatusBadge status={req.status} />
                  </div>
                  <p style={{ fontSize: 12, color: TAUPE }}>{req.content_description} · {req.weight_kg}kg · {req.budget_per_kg}€/kg</p>
                  <p style={{ fontSize: 11, color: TAUPE, marginTop: 2 }}>{t.requests.deadline_label}: {req.deadline_date} · {t.requests.applications}: {req.applications_count}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={e => { e.stopPropagation(); setToDelete({ id: req.id, label: `${req.origin_airport_code} → ${req.destination_airport_code}` }) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                      <Trash2 size={15} color={RED} />
                    </button>
                  <ChevronRight size={16} color={TAUPE} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title={t.requests.delete_confirm}>
        <p style={{ fontSize: 13, color: TAUPE, marginBottom: 20 }}>{toDelete?.label}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setToDelete(null)} disabled={deleting}
            style={{ padding: '10px 20px', background: 'transparent', color: TAUPE, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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
