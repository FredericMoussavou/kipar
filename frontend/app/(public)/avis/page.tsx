'use client'
import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { WHITE, BORDER, CHARCOAL, TAUPE, SAND } from '@/lib/theme'
import { useTranslation } from '@/hooks/useTranslation'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useResponsive } from '@/hooks/useResponsive'
import HeroHeader from '@/components/layout/HeroHeader'
import { publicApi } from '@/lib/api'

interface PlatformReview {
  id: string
  rating: number
  comment: string | null
  author: string
  created_at: string
}

const PAGE = 20

export default function AvisPubliquePage() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const { paddingH, fontSizeH2 } = useResponsive()
  const [reviews, setReviews] = useState<PlatformReview[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async (nextOffset: number, append: boolean) => {
    setLoading(true)
    try {
      const data = await publicApi<PlatformReview[]>(`/platform-reviews?limit=${PAGE}&offset=${nextOffset}`)
      const list = Array.isArray(data) ? data : []
      setReviews(prev => (append ? [...prev, ...list] : list))
      setHasMore(list.length === PAGE)
      setOffset(nextOffset)
    } catch {
      if (!append) setReviews([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load(0, false) }, [])

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      <HeroHeader
        imageUrl="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&q=80"
        minHeight={isMobile ? 220 : 200}
      >
        <div style={{ padding: isMobile ? `48px ${paddingH}px 24px` : '32px' }}>
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: fontSizeH2, fontWeight: 800, color: '#fff', margin: 0 }}>
            {t.avis_page.title}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 8 }}>{t.avis_page.subtitle}</p>
        </div>
      </HeroHeader>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 80px' }}>
        {loading && reviews.length === 0 ? (
          <p style={{ color: TAUPE, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>{t.avis_page.loading}</p>
        ) : reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 6 }}>{t.avis_page.empty_title}</p>
            <p style={{ color: TAUPE, fontSize: 13 }}>{t.avis_page.empty_subtitle}</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
              {reviews.map(r => (
                <div key={r.id} style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 20 }}>
                  <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} size={15} fill={r.rating >= n ? '#F59E0B' : 'none'} color={r.rating >= n ? '#F59E0B' : BORDER} />
                    ))}
                  </div>
                  {r.comment && (
                    <p style={{ fontSize: 14, color: CHARCOAL, lineHeight: 1.6, marginBottom: 14, fontStyle: 'italic' }}>"{r.comment}"</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: SAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-syne,Syne)', fontSize: 13, fontWeight: 800, color: CHARCOAL, flexShrink: 0 }}>
                      {(r.author || 'K').charAt(0)}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL }}>{r.author}</div>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                <button onClick={() => load(offset + PAGE, true)} disabled={loading}
                  style={{ background: SAND, border: '1px solid ' + BORDER, borderRadius: 99, padding: '10px 28px', fontSize: 13, fontWeight: 700, color: CHARCOAL, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {loading ? t.avis_page.loading : t.avis_page.load_more}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}