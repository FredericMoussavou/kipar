import { RED, GREEN, AMBER, LIME, ORANGE } from './theme'

/**
 * Calcule le gradient et la couleur d'accent du KiparTrust selon le score.
 *
 * Le score KiparTrust va de 0 à 100, base 50 à la création du compte.
 *
 * Paliers :
 *  - 75+   : excellent (amber → lime → vert)
 *  - 50-74 : bon (amber → lime)
 *  - 30-49 : moyen (rouge → amber)
 *  - <30   : faible (rouge → orange)
 *
 * @param score - Score KiparTrust (0-100)
 * @returns gradient CSS et couleur d'accent
 */
export function getTrustGradient(score: number): { gradient: string; color: string } {
  if (score >= 75) {
    return {
      gradient: `linear-gradient(90deg, ${AMBER} 0%, ${LIME} 60%, ${GREEN} 100%)`,
      color: GREEN,
    }
  }
  if (score >= 50) {
    return {
      gradient: `linear-gradient(90deg, ${AMBER} 0%, ${LIME} 100%)`,
      color: LIME,
    }
  }
  if (score >= 30) {
    return {
      gradient: `linear-gradient(90deg, ${RED} 0%, ${AMBER} 100%)`,
      color: AMBER,
    }
  }
  return {
    gradient: `linear-gradient(90deg, ${RED} 0%, ${ORANGE} 100%)`,
    color: RED,
  }
}

/**
 * Normalise un score KiparTrust : arrondi entier, plafonné à [0, 100].
 * Si le score est null/undefined/0, retourne 50 (base à la création).
 */
export function normalizeTrustScore(score: number | null | undefined): number {
  if (score === null || score === undefined || score === 0) return 50
  return Math.min(Math.max(Math.round(score), 0), 100)
}