'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Package, ChevronRight } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import api from '@/lib/api'

import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER } from '@/lib/theme'

export default function PackagesPage() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['my-bookings'],
    enabled: isAuthenticated(),
    queryFn: async () => {
      const res = await api.get('/bookings/detail')
      return res.data
    },
  })

  return (
    <div style={{ background: '#FBFBFF', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: RED, padding: '48px 20px 24px', color: '#fff', borderRadius:'20px' }}>
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800 }}>
          {t.packages.title}
        </h1>
        <p style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          {bookings.length} réservation{bookings.length > 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ padding: '20px 20px 80px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 90, background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}` }} />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: SAND, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Package size={28} color={TAUPE} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: CHARCOAL, marginBottom: 8 }}>
              {t.packages.empty}
            </p>
            <p style={{ fontSize: 13, color: TAUPE }}>
              Trouvez un trajet et envoyez votre premier colis
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bookings.map((booking: any) => (
              <div
                key={booking.id}
                onClick={() => router.push(`/packages/${booking.id}`)}
                style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(220,0,41,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
              >
                {/* Icône */}
                <div style={{ width: 44, height: 44, borderRadius: 14, background: SAND, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={20} color={CHARCOAL2} />
                </div>

                {/* Infos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {booking.content_description || 'Colis'}
                    </p>
                    <StatusBadge status={booking.status} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: TAUPE }}>
                    {booking.origin_airport_code && (
                      <span style={{ fontFamily: 'var(--font-syne,Syne)', fontWeight: 700, color: CHARCOAL2 }}>
                        {booking.origin_airport_code} → {booking.destination_airport_code}
                      </span>
                    )}
                    <span>{booking.weight_kg} kg</span>
                    <span>{booking.amount?.toFixed(2)}€</span>
                  </div>
                </div>

                <ChevronRight size={16} color={TAUPE} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
