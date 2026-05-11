'use client'
import { COLORS } from '@/lib/theme'

export type WeightUnit = 'kg' | 'lb' | 'g' | 't'

// Table de conversion vers kg — extensible
const TO_KG: Record<WeightUnit, number> = {
  kg: 1,
  lb: 0.453592,
  g: 0.001,
  t: 1000,
}

// Labels courts — extensible
const UNIT_LABELS: Record<WeightUnit, string> = {
  kg: 'kg',
  lb: 'lb',
  g: 'g',
  t: 't',
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value
  const inKg = value * TO_KG[from]
  return inKg / TO_KG[to]
}

export function unitLabel(unit: WeightUnit): string {
  return UNIT_LABELS[unit] ?? unit
}

interface WeightDisplayProps {
  value: number         // valeur dans l'unite du trip (source)
  unit: WeightUnit      // unite native du trip
  userUnit?: WeightUnit // preference utilisateur
  showConversion?: boolean
  style?: React.CSSProperties
}

export function WeightDisplay({ value, unit, userUnit, showConversion = true, style }: WeightDisplayProps) {
  const needsConversion = showConversion && userUnit && userUnit !== unit
  const altValue = needsConversion ? convertWeight(value, unit, userUnit!) : null

  return (
    <span style={style}>
      <span style={{ fontWeight: 500, color: COLORS.charcoal }}>
        {value.toFixed(2)} {unitLabel(unit)}
      </span>
      {altValue !== null && (
        <span style={{ fontSize: '0.85em', color: COLORS.charcoal2, marginLeft: 4 }}>
          ≃ {Math.floor(altValue * 100) / 100} {unitLabel(userUnit!)}
        </span>
      )}
    </span>
  )
}
