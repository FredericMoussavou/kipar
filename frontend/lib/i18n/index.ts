import { fr } from './fr'
import { en } from './en'
import { es } from './es'
import type { Translations } from './fr'

const translations: Record<string, Translations> = { fr, en , es}

export function getT(lang: string = 'fr'): Translations {
  return translations[lang] || translations.fr
}

export type { Translations }
export { fr, en, es }
