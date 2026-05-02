import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'

interface User {
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
}

interface AuthStore {
  token: string | null
  user: User | null
  setToken: (token: string) => void
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
      setToken: (token) => {
        set({ token })
        if (typeof window !== 'undefined') {
          localStorage.setItem('kipar_token', token)
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
        set({ token: null, user: null })
        if (typeof window !== 'undefined') {
          localStorage.removeItem('kipar_token')
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