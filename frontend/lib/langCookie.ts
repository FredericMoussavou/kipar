export const LANG_COOKIE = 'kipar_lang'
export const SUPPORTED_LANGS = ['fr', 'en', 'es'] as const
export type SupportedLang = typeof SUPPORTED_LANGS[number]

export function getLangCookie(): SupportedLang {
  if (typeof document === 'undefined') return 'fr'
  const match = document.cookie.match(/(?:^|;\s*)kipar_lang=([^;]*)/)
  const val = match?.[1]
  return (SUPPORTED_LANGS as readonly string[]).includes(val ?? '') ? val as SupportedLang : 'fr'
}

export function setLangCookie(lang: SupportedLang) {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `kipar_lang=${lang};path=/;expires=${expires.toUTCString()};SameSite=Lax`
}
