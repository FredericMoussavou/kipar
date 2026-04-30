'use client'
import { RED } from '@/lib/theme'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Search, Package, Bell, LogOut, ChevronDown, User, Plane } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const items = [
    { href: '/dashboard', icon: Home,    label: t.nav.home },
    { href: '/search',    icon: Search,  label: t.nav.trips },
    { href: '/carrier', icon: Plane, label: t.nav.carrier},
    { href: '/packages',  icon: Package, label: t.nav.my_packages },
  ]

  return (
    <nav className="bg-white border-b border-k-border sticky top-0 z-40"
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">

        <Link href="/dashboard">
          <span className="font-syne text-xl font-extrabold text-k-charcoal tracking-tight">
            KIPAR<span style={{ color: RED }}>.</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {items.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl text-xs font-medium transition-all',
                  active ? 'text-k-red' : 'text-k-taupe hover:text-k-charcoal hover:bg-k-sand'
                )}>
                <Icon className={cn('w-5 h-5', active ? 'stroke-[2.5px]' : 'stroke-[1.5px]')} />
                <span>{label}</span>
                {active && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-t-full bg-k-red" />
                )}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full bg-k-sand border border-k-border flex items-center justify-center text-k-taupe hover:text-k-charcoal transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-k-border hover:bg-k-sand transition-colors">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-syne font-bold text-white text-sm"
                style={{ backgroundColor: RED }}>
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-k-taupe" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-k-border rounded-kipar shadow-kipar-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-k-border">
                  <p className="text-sm font-medium text-k-charcoal truncate">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-k-taupe truncate">{user?.email}</p>
                </div>
                <Link href="/profile"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-k-charcoal hover:bg-k-sand transition-colors"
                  onClick={() => setMenuOpen(false)}>
                  <User className="w-4 h-4" />
                  {t.profile.title}
                </Link>
                <button onClick={() => { logout(); router.replace('/login') }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                  <LogOut className="w-4 h-4" />
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
