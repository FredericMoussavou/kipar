/**
 * extractApiError — normalise une erreur API (axios) en STRING affichable.
 * Gere : detail string, detail array (FastAPI 422 [{msg}] ou custom [{message}]),
 * detail object, ou fallback. Empeche tout crash "Objects are not valid as a React child".
 */
export function extractApiError(err: any, fallback = 'Une erreur est survenue'): string {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d: any) => (typeof d === 'string' ? d : d?.msg || d?.message || ''))
      .filter(Boolean)
    if (msgs.length) return msgs.join(' \u00b7 ')
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || fallback
  }
  if (typeof err?.message === 'string' && err.message.trim()) return err.message
  return fallback
}
