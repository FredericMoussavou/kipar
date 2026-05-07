'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X, User, Settings, Bell, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import { getAvatarUrl } from '@/lib/cloudinary'
import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE } from '@/lib/theme'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function Drawer({ isOpen, onClose }: DrawerProps) {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const router = useRouter()

  // Bloque le scroll body quand ouvert
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleLogout = () => {
    onClose()
    logout()
    router.push('/login')
  }

  const avatarUrl = user ? getAvatarUrl(user.avatar_url, user.first_name, user.last_name) : null

  const items = [
    { href: '/profile', icon: User, label: t.nav.profile },
    { href: '/preferences', icon: Settings, label: t.profile_edit.section_preferences },
    { href: '/notifications', icon: Bell, label: t.nav.messages },
  ]

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 200, opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 280,
        background: WHITE, zIndex: 201,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        boxShadow: isOpen ? '4px 0 32px rgba(0,0,0,0.12)' : 'none',
      }}>

        {/* Header */}
        <div style={{ padding: '52px 20px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <button
            type="button" onClick={onClose}
            style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', border: `1px solid ${BORDER}`, background: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={16} color={CHARCOAL} />
          </button>

          {/* Avatar */}
          <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', marginBottom: 12, border: `2px solid ${BORDER}` }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: WHITE }}>
                  {user?.first_name?.[0] ?? '?'}
                </span>
              </div>
            )}
          </div>

          {/* Nom + username */}
          <p style={{ fontSize: 15, fontWeight: 700, color: CHARCOAL, margin: 0 }}>
            {user?.first_name} {user?.last_name}
          </p>
          {user?.username && (
            <p style={{ fontSize: 12, color: TAUPE, margin: '2px 0 0' }}>@{user.username}</p>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {items.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', textDecoration: 'none', color: CHARCOAL, fontSize: 14, fontWeight: 500, borderBottom: `1px solid ${SAND}` }}>
              <Icon size={18} color={TAUPE} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Déconnexion */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${BORDER}` }}>
          <button type="button" onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, border: `1px solid ${BORDER}`, background: 'transparent', fontSize: 14, fontWeight: 600, color: CHARCOAL, cursor: 'pointer' }}>
            <LogOut size={18} color={TAUPE} />
            {t.profile_edit.logout}
          </button>
        </div>
      </div>
    </>
  )
}
