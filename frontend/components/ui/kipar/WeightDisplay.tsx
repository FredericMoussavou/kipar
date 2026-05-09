'use client'
import { fromKg, unitLabel } from '@/lib/weight'
import { COLORS } from '@/lib/theme'

type WeightUnit = 'kg' | 'lb' | 'g'

interface WeightDisplayProps {
  value: number           // valeur dans l'unite du trip
  unit: WeightUnit        // unite native du trip
  userUnit?: WeightUnit   // preference utilisateur (pour la conversion)
  showConversion?: boolean
  style?: React.CSSProperties
}

export function WeightDisplay({
  value,
  unit,
  userUnit,
  showConversion = true,
  style,
}: WeightDisplayProps) {
  const showAlt = showConversion && userUnit && userUnit !== unit

  // Convertir vers kg puis vers l'unite cible
  const toKgValue = unit === 'kg' ? value : unit === 'lb' ? value * 0.453592 : value * 0.001
  const altValue = userUnit === 'kg'
    ? toKgValue
    : userUnit === 'lb'
    ? toKgValue * 2.20462
    : toKgValue * 1000

  // Si userUnit est defini et different, mettre l'unite user en avant
  const primary = showAlt ? { value: altValue.toFixed(2), unit: userUnit! } : { value: value.toFixed(2), unit }
  const secondary = showAlt ? { value: value.toFixed(2), unit } : null

  return (
    <span style={style}>
      <span style={{ fontWeight: 500, color: COLORS.charcoal }}>
        {primary.value} {unitLabel(primary.unit as WeightUnit)}
      </span>
      {secondary && (
        <span style={{ fontSize: '0.85em', color: COLORS.charcoal2, marginLeft: 4 }}>
          ({secondary.value} {unitLabel(secondary.unit as WeightUnit)})
        </span>
      )}
    </span>
  )
}
