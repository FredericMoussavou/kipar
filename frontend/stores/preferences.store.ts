import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'auto'

interface PreferencesStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  /**
   * Retourne le thème effectivement appliqué :
   * - 'light' ou 'dark' direct si choix explicite
   * - sinon résout 'auto' selon les préférences système
   * Toujours appelable côté client uniquement (utilise window.matchMedia)
   */
  getEffectiveTheme: () => 'light' | 'dark'
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      theme: 'auto',
      setTheme: (theme) => {
        set({ theme })
        // Applique immédiatement la classe sur <html> pour Tailwind dark mode
        if (typeof window !== 'undefined') {
          applyThemeToDocument(get().getEffectiveTheme())
        }
      },
      getEffectiveTheme: () => {
        const t = get().theme
        if (t === 'light' || t === 'dark') return t
        // 'auto' → on lit le media query système
        if (typeof window === 'undefined') return 'light'
        return window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      },
    }),
    {
      name: 'kipar-preferences',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)

/**
 * Applique le thème en ajoutant/retirant la classe `dark` sur <html>.
 * Tailwind utilise cette classe pour activer le dark mode (avec `darkMode: 'class'`).
 */
export function applyThemeToDocument(effectiveTheme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (effectiveTheme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}