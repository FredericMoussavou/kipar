'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, Search, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/useTranslation'

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useTranslation()

  const items = [
    { href: '/dashboard', icon: Home, label: t.nav.home },
    { href: '/search', icon: Search, label: t.nav.trips },
    { href: '/packages', icon: Package, label: t.nav.my_packages },
    { href: '/profile', icon: User, label: t.nav.profile },
  ]

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-kipar-border z-50">
      <div className="flex items-center">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 transition-colors',
                active ? 'text-kipar-green' : 'text-kipar-muted hover:text-kipar-text'
              )}
            >
              <Icon
                className={cn('w-5 h-5', active && 'stroke-[2.5px]')}
              />
              <span className={cn(
                'text-[10px]',
                active ? 'font-semibold' : 'font-normal'
              )}>
                {label}
              </span>
              {active && (
                <div className="absolute bottom-0 w-8 h-0.5 bg-kipar-green rounded-t-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
