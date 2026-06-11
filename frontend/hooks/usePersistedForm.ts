import { useEffect, useRef } from 'react'

/**
 * Persiste un snapshot de formulaire dans sessionStorage.
 * - restauration SILENCIEUSE au montage (une seule fois)
 * - sauvegarde debounce a chaque changement de `values`
 * - clear() a appeler apres soumission : efface ET bloque toute re-sauvegarde
 *
 * Survit au retour / navigation interne ; s'efface a la fermeture de l'onglet.
 *
 * @example
 *   const values = { ...watch(), originInput, departureDate, photos }
 *   const { clear } = usePersistedForm('kipar_form_book_42', values, (saved) => {
 *     reset({ ... }); setOriginInput(saved.originInput ?? '')
 *   })
 *   // onSuccess: clear()
 */
export function usePersistedForm<T>(
  key: string,
  values: T,
  restore: (saved: T) => void,
): { clear: () => void } {
  const restoredRef = useRef(false)
  const clearedRef = useRef(false)

  // Restauration au montage (une seule fois)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (typeof window === 'undefined') return
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) restore(JSON.parse(raw) as T)
    } catch {
      // donnees corrompues -> on ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sauvegarde debounce a chaque changement de values
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!restoredRef.current) return   // pas avant la restauration initiale
    if (clearedRef.current) return     // plus jamais apres un clear()
    const id = setTimeout(() => {
      if (clearedRef.current) return
      try {
        sessionStorage.setItem(key, JSON.stringify(values))
      } catch {
        // quota / serialisation -> on ignore
      }
    }, 300)
    return () => clearTimeout(id)
  }, [key, values])

  const clear = () => {
    clearedRef.current = true
    if (typeof window === 'undefined') return
    try {
      sessionStorage.removeItem(key)
    } catch {
      // ignore
    }
  }

  return { clear }
}
