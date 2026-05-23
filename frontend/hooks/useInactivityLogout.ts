import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'

const INACTIVITY_KEY = 'kipar_last_active'
const TIMEOUT_MS = 30 * 60 * 1000 // 30 min

export function useInactivityLogout() {
  const logout = useAuthStore(s => s.logout)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkInactivity = () => {
      if (!isAuthenticated()) return
      const last = localStorage.getItem(INACTIVITY_KEY)
      if (!last) return
      if (Date.now() - parseInt(last, 10) >= TIMEOUT_MS) {
        localStorage.removeItem(INACTIVITY_KEY)
        logout()
      }
    }

    const markInactive = () => {
      if (isAuthenticated()) {
        localStorage.setItem(INACTIVITY_KEY, String(Date.now()))
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        markInactive()
      } else {
        checkInactivity()
      }
    }

    const handleBlur = () => markInactive()
    const handleFocus = () => checkInactivity()

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    // Verifier aussi au montage si on revient apres une longue absence
    checkInactivity()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [logout, isAuthenticated])
}
