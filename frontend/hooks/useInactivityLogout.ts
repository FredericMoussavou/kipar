import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'

const INACTIVITY_KEY = 'kipar_last_active'
const TIMEOUT_MS = 30 * 60 * 1000 // 30 min sans activite -> deconnexion
const CHECK_INTERVAL_MS = 60 * 1000 // verification periodique
const WRITE_THROTTLE_MS = 10 * 1000 // 1 ecriture localStorage / 10s max
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const

export function useInactivityLogout() {
  const logout = useAuthStore(s => s.logout)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let lastWrite = 0

    const markActive = () => {
      if (!isAuthenticated()) return
      const now = Date.now()
      if (now - lastWrite < WRITE_THROTTLE_MS) return // throttle ecritures
      lastWrite = now
      localStorage.setItem(INACTIVITY_KEY, String(now))
    }

    const checkInactivity = () => {
      if (!isAuthenticated()) return
      const last = localStorage.getItem(INACTIVITY_KEY)
      if (!last) return
      if (Date.now() - parseInt(last, 10) >= TIMEOUT_MS) {
        localStorage.removeItem(INACTIVITY_KEY)
        logout()
      }
    }

    // Initialiser le timestamp si absent (sinon checkInactivity ne declenche jamais)
    if (isAuthenticated() && !localStorage.getItem(INACTIVITY_KEY)) {
      localStorage.setItem(INACTIVITY_KEY, String(Date.now()))
      lastWrite = Date.now()
    }

    // Activite reelle : reset du compteur (throttle)
    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, markActive, { passive: true })
    )

    // Verification periodique : deconnecte meme onglet visible et immobile
    const intervalId = window.setInterval(checkInactivity, CHECK_INTERVAL_MS)

    // Retour sur l'onglet apres absence
    const handleFocus = () => checkInactivity()
    const handleVisibility = () => { if (!document.hidden) checkInactivity() }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    // Verifier au montage (retour apres longue absence)
    checkInactivity()

    return () => {
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, markActive))
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [logout, isAuthenticated])
}
