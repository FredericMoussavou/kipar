import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'

interface User {
  pending_trip_id?: string | null
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  avatar_url: string | null
  trust_score: number
  kyc_status: string
  is_carrier: boolean
  is_sender: boolean
  is_receiver: boolean
  language: string
  notify_by_email: boolean
  notify_by_push: boolean
  notify_by_sms: boolean
  email_verified: boolean
  phone_verified: boolean
  weight_unit: string
  currency: string
  payment_method: string | null
  payment_country: string | null
  mobile_money_number: string | null
  iban: string | null
  onboarding_completed: boolean
  is_admin: boolean
  username: string | null
  username_updated_at: string | null
  address: string | null
  is_premium: boolean
  premium_expires_at: string | null
  premium_plan: string | null
  totp_enabled: boolean
}

interface AuthStore {
  token: string | null
  user: User | null
  unreadCount: number
  setUnreadCount: (count: number | ((prev: number) => number)) => void
  setToken: (token: string) => void
  setRefreshToken: (token: string) => void
  silentRefresh: () => Promise<boolean>
  setUser: (user: User) => void
  /**
   * Met à jour le user en mergeant des champs partiels.
   * Utile pour les updates optimistes (langue, notifs) sans refetch complet.
   */
  patchUser: (partial: Partial<User>) => void
  /**
   * Refetch GET /users/me et met à jour le store.
   * Utiliser après une mutation qui modifie l'user en BDD (PATCH téléphone, avatar, etc.).
   */
  refreshUser: () => Promise<void>
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      unreadCount: 0,
      setUnreadCount: (val) => set(state => ({ unreadCount: typeof val === 'function' ? val(state.unreadCount) : val })),
      setRefreshToken: (refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('kipar_refresh_token', refreshToken)
        }
      },
      silentRefresh: async () => {
        if (typeof window === 'undefined') return false
        const refreshToken = localStorage.getItem('kipar_refresh_token')
        if (!refreshToken) return false
        try {
          const res = await fetch(
            (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1') + '/auth/refresh',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken }),
            }
          )
          if (!res.ok) {
            localStorage.removeItem('kipar_refresh_token')
            return false
          }
          const data = await res.json()
          get().setToken(data.access_token)
          if (data.refresh_token) get().setRefreshToken(data.refresh_token)
          return true
        } catch {
          return false
        }
      },
      setToken: (token) => {
        set({ token })
        if (typeof window !== 'undefined') {
          localStorage.setItem('kipar_token', token)
          document.cookie = 'kipar_token=' + token + '; path=/; max-age=86400; SameSite=Lax'
        }
      },
      setUser: (user) => set({ user }),
      patchUser: (partial) => {
        const current = get().user
        if (!current) return
        set({ user: { ...current, ...partial } })
      },
      refreshUser: async () => {
        try {
          const res = await api.get<User>('/users/me')
          set({ user: res.data })
        } catch (err) {
          // Silencieux : si l'API échoue, on garde le user actuel.
          // L'intercepteur api.ts gère déjà la déconnexion sur 401.
          console.error('refreshUser failed:', err)
        }
      },
      logout: () => {
        const token = get().token
        if (typeof window !== 'undefined') localStorage.removeItem('kipar_refresh_token')
        // Redirection immediate
        set({ token: null, user: null, unreadCount: 0 })
        if (typeof window !== 'undefined') {
          localStorage.removeItem('kipar_token')
          document.cookie = 'kipar_token=; path=/; max-age=0'
          // Appel API en arriere-plan
          if (token) {
            fetch(process.env.NEXT_PUBLIC_API_URL + '/auth/logout', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + token },
            }).catch(() => {})
          }
        }
      },
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'kipar-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)