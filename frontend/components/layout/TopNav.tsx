'use client'
import { RED, CHARCOAL, TAUPE, SAND, BORDER, WHITE, BG } from '@/lib/theme'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Search, Package, Bell, LogOut, ChevronDown, User, Plane, CheckCheck } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import { useSSE } from '@/hooks/useSSE'

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const token = useAuthStore(s => s.token)
  const { notifications, unreadCount, markAllRead, markOneRead } = useSSE(token)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const items = [
    { href: '/dashboard', icon: Home,    label: t.nav.home },
    { href: '/search',    icon: Search,  label: t.nav.trips },
    { href: '/carrier',   icon: Plane,   label: t.nav.carrier },
    { href: '/packages',  icon: Package, label: t.nav.my_packages },
  ]

  return (
    <nav style={{
      background: WHITE,
      boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 900, color: CHARCOAL, letterSpacing: '-0.02em' }}>
            KIPAR<span style={{ color: RED }}>.</span>
          </span>
        </Link>

        {/* Nav items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {items.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '8px 20px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                color: active ? RED : TAUPE,
                textDecoration: 'none',
                background: active ? 'rgba(220,0,41,0.04)' : 'transparent',
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = SAND }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
                <span>{label}</span>
                {active && (
                  <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2, background: RED, borderRadius: '2px 2px 0 0' }} />
                )}
              </Link>
            )
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button onClick={() => setNotifOpen(!notifOpen)} style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', background: SAND, border: '1px solid ' + BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TAUPE }}>
              <Bell size={16} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: RED, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid ' + WHITE }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 320, background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.10)', zIndex: 50, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid ' + BORDER }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL }}>{t.notifications.title}</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: RED, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <CheckCheck size={13} />
                      {t.notifications.mark_all_read}
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: TAUPE, margin: 0 }}>{t.notifications.empty}</p>
                  ) : notifications.map(n => (
                    <div key={n.id} onClick={() => { markOneRead(n.id); if (n.link) router.push(n.link); setNotifOpen(false) }}
                      style={{ padding: '12px 16px', borderBottom: '1px solid ' + BORDER, cursor: 'pointer', background: n.is_read ? WHITE : 'rgba(220,0,41,0.03)', display: 'flex', gap: 10, alignItems: 'flex-start' }}
                      onMouseEnter={e => (e.currentTarget.style.background = SAND)}
                      onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? WHITE : 'rgba(220,0,41,0.03)')}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.is_read ? 'transparent' : RED, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: CHARCOAL, margin: '0 0 2px' }}>{n.title}</p>
                        <p style={{ fontSize: 11, color: TAUPE, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(!menuOpen)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px',
              borderRadius: 99, border: '1px solid ' + BORDER, background: WHITE, cursor: 'pointer',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-syne,Syne)', fontWeight: 700, color: WHITE, fontSize: 13 }}>
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <ChevronDown size={14} color={TAUPE} />
            </button>

            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 200, background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.10)', overflow: 'hidden', zIndex: 50 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid ' + BORDER }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL, margin: 0 }}>{user?.first_name} {user?.last_name}</p>
                  <p style={{ fontSize: 11, color: TAUPE, margin: '2px 0 0' }}>{user?.email}</p>
                </div>
                <Link href="/profile" onClick={() => setMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: CHARCOAL, textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = SAND)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <User size={15} />
                  {t.profile.title}
                </Link>
                <button onClick={() => { logout(); router.replace('/login') }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: RED, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,0,41,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <LogOut size={15} />
                  {t.profile.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}