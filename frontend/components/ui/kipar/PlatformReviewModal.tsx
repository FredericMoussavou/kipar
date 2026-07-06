'use client'
import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import Modal from '@/components/ui/kipar/Modal'
import api from '@/lib/api'
import { CHARCOAL, TAUPE, BORDER, RED, WHITE, SAND } from '@/lib/theme'
import { useTranslation } from '@/hooks/useTranslation'
import { toast } from 'sonner'

export default function PlatformReviewModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Charge l'avis existant a l'ouverture
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    api.get('/reviews/platform/me')
      .then(res => {
        const rv = res.data?.review
        if (rv) {
          setRating(rv.rating || 0)
          setComment(rv.comment || '')
          setStatus(rv.status || null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen])

  const submit = async () => {
    if (rating < 1) { toast.error(t.platform_review.error_rating); return }
    setSubmitting(true)
    try {
      await api.post('/reviews/platform', { rating, comment: comment.trim() || null })
      toast.success(t.platform_review.success)
      onClose()
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      toast.error(detail || t.platform_review.error_generic)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.platform_review.title} description={t.platform_review.subtitle}>
      {loading ? (
        <p style={{ fontSize: 13, color: TAUPE, textAlign: 'center', padding: '20px 0' }}>...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {status === 'pending' && (
            <div style={{ background: SAND, borderRadius: 10, padding: '10px 12px', fontSize: 12, color: TAUPE }}>
              {t.platform_review.pending_notice}
            </div>
          )}
          {/* Etoiles */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <Star size={32}
                  fill={(hover || rating) >= n ? RED : 'none'}
                  color={(hover || rating) >= n ? RED : BORDER} />
              </button>
            ))}
          </div>
          {/* Commentaire */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TAUPE, marginBottom: 6 }}>
              {t.platform_review.comment_label}
            </label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder={t.platform_review.comment_placeholder}
              maxLength={500} rows={4}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + BORDER, fontSize: 13, color: CHARCOAL, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            <p style={{ fontSize: 11, color: TAUPE, textAlign: 'right', margin: '4px 0 0' }}>{comment.length}/500</p>
          </div>
          {/* Envoyer */}
          <button onClick={submit} disabled={submitting}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: RED, color: WHITE, fontSize: 14, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? t.platform_review.sending : t.platform_review.submit}
          </button>
        </div>
      )}
    </Modal>
  )
}