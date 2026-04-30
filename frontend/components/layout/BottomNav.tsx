'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Package, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/useTranslation'

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useTranslation()

  const items = [
    { href: '/dashboard', icon: Home,    label: t.nav.home },
    { href: '/search',    icon: Search,  label: t.nav.trips },
    { href: '/packages',  icon: Package, label: t.nav.my_packages },
    { href: '/profile',   icon: User,    label: t.nav.profile },
  ]

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-k-border z-50"
      style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={cn('flex-1 flex flex-col items-center gap-1 py-3 transition-colors relative',
                active ? 'text-k-red' : 'text-k-taupe hover:text-k-charcoal-2'
              )}>
              <Icon className={cn('w-5 h-5', active ? 'stroke-[2px]' : 'stroke-[1.5px]')} />
              <span className={cn('text-[10px]', active ? 'font-semibold' : 'font-normal')}>
                {label}
              </span>
              {active && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-t-full bg-k-red" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
