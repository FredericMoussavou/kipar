import { fr } from './fr'
import { en } from './en'
import type { Translations } from './fr'

const translations: Record<string, Translations> = { fr, en }

export function getT(lang: string = 'fr'): Translations {
  return translations[lang] || translations.fr
}

export type { Translations }
export { fr, en }
