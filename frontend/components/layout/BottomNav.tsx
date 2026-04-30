'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Package, User, Plane } from 'lucide-react'
import { cn } from '@/lib/utils'
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
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t z-50"
      style={{ borderColor: '#EEEBE6', boxShadow: '0 -4px 20px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors relative"
              style={{ color: active ? '#DC0029' : '#B5AFAB' }}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <span style={{ fontSize: 9, fontWeight: active ? 600 : 400 }}>{label}</span>
              {active && (
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-full"
                  style={{ width: 20, height: 2, background: '#DC0029' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
