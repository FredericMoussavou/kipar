'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Package, ChevronRight, Plus } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import StatusBadge from '@/components/ui/kipar/StatusBadge'
import HeroHeader from '@/components/layout/HeroHeader'
import api from '@/lib/api'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, RED } from '@/lib/theme'

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
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>

      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1599658880436-c61792e70672?w=1200&q=80"
        minHeight={160}
      >
        <div style={{ padding: '48px 24px 28px' }} className="md:p-8">
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}
            className="md:text-3xl">
            {t.packages.title}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
            {bookings.length > 1 ? t.packages.booking_count_many.replace('{n}', bookings.length) : t.packages.booking_count_one.replace('{n}', bookings.length)}
          </p>
          <button
            onClick={() => router.push('/requests/new')}
            style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={14} />
            {t.requests.create_alert_btn}
          </button>
        </div>
      </HeroHeader>

      <div style={{ padding: '20px 20px 80px' }} className="md:px-0">
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 90, background: WHITE, borderRadius: 16, border: '1px solid ' + BORDER }} />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 24, background: SAND, marginBottom: 16 }}>
              <Package size={36} color={TAUPE} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>
              {t.packages.empty}
            </p>
            <p style={{ fontSize: 13, color: TAUPE }}>
              {t.packages.empty_sub}
            </p>
            <button
              onClick={() => router.push('/requests/new')}
              style={{ marginTop: 16, padding: '12px 24px', background: RED, color: WHITE, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              {t.requests.post_btn}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bookings.map((booking: any) => (
              <div
                key={booking.id}
                onClick={() => router.push(`/packages/${booking.id}`)}
                style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 16, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(220,0,41,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
              >
                <div style={{ width: 44, height: 44, borderRadius: 14, background: SAND, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={20} color={CHARCOAL2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {booking.content_description || t.packages.default_content}
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