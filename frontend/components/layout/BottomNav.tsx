'use client'
import { RED, TAUPE, WHITE } from '@/lib/theme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Package, User, Plane } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useTranslation()

  const items = [
    { href: '/dashboard', icon: Home,    label: t.nav.home },
    { href: '/search',    icon: Search,  label: t.nav.trips },
    { href: '/carrier',   icon: Plane,   label: t.nav.carrier },
    { href: '/packages',  icon: Package, label: t.nav.my_packages },
    { href: '/profile',   icon: User,    label: t.nav.profile },
  ]

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: WHITE,
      boxShadow: '0 -2px 20px rgba(0,0,0,0.06)',
      zIndex: 50,
      display: 'flex',
    }}>
      {items.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '10px 0 12px',
              color: active ? RED : TAUPE,
              textDecoration: 'none',
              position: 'relative',
              transition: 'color 0.2s',
            }}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
            <span style={{ fontSize: 9, fontWeight: active ? 600 : 400 }}>{label}</span>
            {active && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 20,
                height: 2,
                background: RED,
                borderRadius: '2px 2px 0 0',
              }} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}