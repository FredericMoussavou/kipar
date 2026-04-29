import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  trust_score: number
  kyc_status: string
  is_carrier: boolean
  language: string
}

interface AuthStore {
  token: string | null
  user: User | null
  setToken: (token: string) => void
  setUser: (user: User) => void
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
