export type WeightUnit = 'kg' | 'lb' | 'g'

const TO_KG: Record<WeightUnit, number> = {
  kg: 1,
  lb: 0.453592,
  g: 0.001,
}

const FROM_KG: Record<WeightUnit, number> = {
  kg: 1,
  lb: 2.20462,
  g: 1000,
}

/** Convertit une valeur depuis l'unite utilisateur vers kg (pour l'API) */
export function toKg(value: number, unit: WeightUnit): number {
  return parseFloat((value * TO_KG[unit]).toFixed(4))
}

/** Convertit une valeur depuis kg (API) vers l'unite utilisateur (affichage) */
export function fromKg(value: number, unit: WeightUnit): number {
  return parseFloat((value * FROM_KG[unit]).toFixed(2))
}

/** Label court de l'unite */
export function unitLabel(unit: WeightUnit): string {
  return unit
}
