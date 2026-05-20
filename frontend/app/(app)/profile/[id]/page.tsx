'use client'

import { useState,useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, User as UserIcon, Star, Calendar, Package, Plane, MessageCircle } from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useAuthStore } from '@/stores/auth.store'
import HeroHeader from '@/components/layout/HeroHeader'
import KiparTrustGauge from '@/components/ui/kipar/KiparTrustGauge'
import api from '@/lib/api'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, GREEN, RED } from '@/lib/theme'

interface PublicProfile {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  kyc_status: string
  trust_score: number
  is_carrier: boolean
  is_premium: boolean
  created_at: string
  deliveries_as_sender: number
  deliveries_as_carrier: number
  trips_count: number
  reviews_count: number
  avg_rating: number | null
}

interface Reviewer {
  id: string
  display_name: string
  avatar_url: string | null
}

interface ReviewItem {
  id: string
  score: number
  comment: string | null
  created_at: string
  reviewer: Reviewer
}

interface ReviewList {
  items: ReviewItem[]
  total: number
  avg_score: number | null
}

const HERO_IMG = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&q=80'

function formatMemberSince(createdAt: string, t: any): string {
  const created = new Date(createdAt)
  const now = new Date()
  const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth())
  if (months < 12) {
    return `${months} ${t.profile_public.months}`
  }
  const years = Math.floor(months / 12)
  return `${years} ${years === 1 ? t.profile_public.year : t.profile_public.years}`
}

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div style={{
      flex: 1,
      background: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      padding: '14px 12px',
      textAlign: 'center',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, color: TAUPE }}>
        {icon}
      </div>
      <p style={{
        fontFamily: 'var(--font-syne, Syne)',
        fontSize: 20,
        fontWeight: 800,
        color: CHARCOAL,
        lineHeight: 1,
      }}>
        {value}
      </p>
      <p style={{ fontSize: 10, color: TAUPE, marginTop: 4, lineHeight: 1.2 }}>
        {label}
      </p>
    </div>
  )
}

function ReviewCard({ review }: { review: ReviewItem }) {
  const { t } = useTranslation()
  const date = new Date(review.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div style={{
      background: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: CHARCOAL,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {review.reviewer.avatar_url ? (
            <img
              src={review.reviewer.avatar_url}
              alt={review.reviewer.display_name}
              style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover' }}
            />
          ) : (
            <span style={{
              fontFamily: 'var(--font-syne, Syne)',
              fontSize: 13,
              fontWeight: 700,
              color: WHITE,
            }}>
              {review.reviewer.display_name[0]}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL }}>
            {review.reviewer.display_name}
          </p>
          <p style={{ fontSize: 11, color: TAUPE }}>{date}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Star size={14} fill={RED} color={RED} />
          <span style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL }}>
            {review.score.toFixed(1)}
          </span>
        </div>
      </div>
      <p style={{
        fontSize: 13,
        color: review.comment ? CHARCOAL2 : TAUPE,
        fontStyle: review.comment ? 'normal' : 'italic',
        lineHeight: 1.5,
      }}>
        {review.comment || t.profile_public.no_comment}
      </p>
    </div>
  )
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [reviewPage, setReviewPage] = useState(1)
  const [accumulatedReviews, setAccumulatedReviews] = useState<ReviewItem[]>([])
  const isMobile = useIsMobile()
  const REVIEWS_PER_PAGE = 5

  // Redirection si c'est mon propre profil
  const isOwnProfile = !!user?.id && !!id && user.id === id

  // Profil public
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<PublicProfile>({
    queryKey: ['public-profile', id],
    queryFn: async () => {
      const res = await api.get(`/users/${id}`)
      return res.data
    },
    enabled: !!id,
  })

  // Avis paginés
  const { data: reviews } = useQuery<ReviewList>({
    queryKey: ['public-profile-reviews', id, reviewPage],
    queryFn: async () => {
      if (isMobile) {
        // Mobile : charge toujours depuis le debut avec offset 0, limit = page * 5
        const res = await api.get(`/reviews/user/${id}?limit=${reviewPage * REVIEWS_PER_PAGE}&offset=0`)
        return res.data
      } else {
        // Desktop : pagination classique
        const offset = (reviewPage - 1) * REVIEWS_PER_PAGE
        const res = await api.get(`/reviews/user/${id}?limit=${REVIEWS_PER_PAGE}&offset=${offset}`)
        return res.data
      }
    },
    enabled: !!id && user?.id !== id,
  })

  // Loading state
  if (profileLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'rgba(240,237,232,0.2)', padding: 20, paddingTop: 80 }}>
        <p style={{ textAlign: 'center', color: TAUPE, fontSize: 14 }}>
          {t.profile_public.loading}
        </p>
      </div>
    )
  }

  // 404 / erreur
  if (profileError || !profile) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'rgba(240,237,232,0.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}>
        <p style={{ color: TAUPE, fontSize: 14, marginBottom: 16 }}>
          {t.profile_public.user_not_found}
        </p>
        <button
          onClick={() => router.back()}
          style={{
            background: CHARCOAL,
            color: WHITE,
            border: 'none',
            borderRadius: 12,
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t.profile_public.back}
        </button>
      </div>
    )
  }

  const fullName = `${profile.first_name} ${profile.last_name}`
  const initials = `${profile.first_name[0] || ''}${profile.last_name[0] || ''}`
  const isKycVerified = profile.kyc_status === 'verified'
  const memberSince = formatMemberSince(profile.created_at, t)

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>

      {/* Hero */}
      <HeroHeader imageUrl={HERO_IMG} minHeight={200} gradient="vertical">
        <div style={{ padding: '48px 20px 24px', position: 'relative', textAlign: 'center' }}>
          <button
            onClick={() => router.back()}
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} color={WHITE} />
          </button>

          {/* Avatar */}
          <div style={{
            width: 80,
            height: 80,
            margin: '0 auto 12px',
            borderRadius: 24,
            background: CHARCOAL,
            border: `3px solid ${WHITE}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={fullName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : initials ? (
              <span style={{
                fontFamily: 'var(--font-syne, Syne)',
                fontSize: 28,
                fontWeight: 800,
                color: WHITE,
              }}>
                {initials}
              </span>
            ) : (
              <UserIcon size={36} color={WHITE} />
            )}
          </div>

          <p style={{
            fontFamily: 'var(--font-syne, Syne)',
            fontSize: 22,
            fontWeight: 800,
            color: WHITE,
            marginBottom: 6,
          }}>
            {fullName}
          </p>

          {/* Badges rôle + KYC */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {profile.is_premium && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#B45309' }}>
                ★ Premium
              </div>
            )}
            {profile.is_carrier && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: WHITE,
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 10px',
                borderRadius: 99,
              }}>
                ✈ {t.profile_public.is_carrier_badge}
              </span>
            )}
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: isKycVerified ? GREEN : 'rgba(255,255,255,0.85)',
              background: isKycVerified ? WHITE : 'rgba(255,255,255,0.15)',
              padding: '4px 10px',
              borderRadius: 99,
            }}>
              {isKycVerified ? `✓ ${t.profile_public.kyc_verified}` : t.profile_public.kyc_pending}
            </span>
          </div>
        </div>
      </HeroHeader>

      {/* Contenu */}
      <div style={{ padding: '20px 16px 80px' }} className="md:max-w-2xl md:mx-auto">

        {/* Gauge KiparTrust centrale */}
        <div style={{
          background: WHITE,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: 24,
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'center',
        }}>
          <KiparTrustGauge score={profile.trust_score} size="lg" />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <StatTile
            icon={<Calendar size={16} />}
            value={memberSince}
            label={t.profile_public.member_since}
          />
          {profile.is_carrier ? (
            <StatTile
              icon={<Package size={16} />}
              value={profile.deliveries_as_carrier}
              label={t.profile_public.deliveries_as_carrier}
            />
          ) : (
            <StatTile
              icon={<Package size={16} />}
              value={profile.deliveries_as_sender}
              label={t.profile_public.deliveries_as_sender}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {profile.is_carrier && (
            <StatTile
              icon={<Plane size={16} />}
              value={profile.trips_count}
              label={t.profile_public.trips_posted}
            />
          )}
          <StatTile
            icon={<MessageCircle size={16} />}
            value={profile.reviews_count}
            label={t.profile_public.reviews_received}
          />
          {profile.avg_rating !== null && (
            <StatTile
              icon={<Star size={16} />}
              value={profile.avg_rating.toFixed(1)}
              label={t.profile_public.avg_rating}
            />
          )}
        </div>

        {/* Avis */}
        <div>
          <p style={{
            fontSize: 11,
            fontWeight: 600,
            color: TAUPE,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 12,
          }}>
            {t.profile_public.reviews_title}
            {reviews && reviews.total > 0 && (
              <span style={{ marginLeft: 6, color: CHARCOAL2 }}>({reviews.total})</span>
            )}
          </p>

          {!reviews || reviews.items.length === 0 ? (
            <div style={{
              background: WHITE,
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
              padding: '32px 20px',
              textAlign: 'center',
            }}>
              <MessageCircle size={32} color={TAUPE} style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: CHARCOAL, marginBottom: 4 }}>
                {t.profile_public.no_reviews}
              </p>
              <p style={{ fontSize: 12, color: TAUPE }}>
                {t.profile_public.no_reviews_sub}
              </p>
            </div>
          ) : (
            <>
              {reviews.items.map(review => (
                <ReviewCard key={review.id} review={review} />
              ))}

              {/* Pagination mobile : charger plus */}
              {isMobile && reviews.total > reviewPage * REVIEWS_PER_PAGE && (
                <button
                  onClick={() => setReviewPage(p => p + 1)}
                  style={{ width: '100%', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 600, color: CHARCOAL, cursor: 'pointer', marginTop: 4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = SAND }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {t.profile_public.load_more}
                </button>
              )}
              {/* Pagination desktop : pages */}
              {!isMobile && reviews.total > REVIEWS_PER_PAGE && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                    disabled={reviewPage === 1}
                    style={{ padding: '8px 16px', background: reviewPage === 1 ? SAND : WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: reviewPage === 1 ? TAUPE : CHARCOAL, cursor: reviewPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ←
                  </button>
                  <span style={{ fontSize: 13, color: TAUPE }}>
                    {reviewPage} / {Math.ceil(reviews.total / REVIEWS_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => setReviewPage(p => p + 1)}
                    disabled={reviewPage >= Math.ceil(reviews.total / REVIEWS_PER_PAGE)}
                    style={{ padding: '8px 16px', background: reviewPage >= Math.ceil(reviews.total / REVIEWS_PER_PAGE) ? SAND : WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: reviewPage >= Math.ceil(reviews.total / REVIEWS_PER_PAGE) ? TAUPE : CHARCOAL, cursor: reviewPage >= Math.ceil(reviews.total / REVIEWS_PER_PAGE) ? 'not-allowed' : 'pointer' }}
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}