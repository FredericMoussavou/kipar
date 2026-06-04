'use client'
import { COLORS } from '@/lib/theme'
import { convertCurrency } from './CurrencyDisplay'
import { convertWeight, unitLabel, type WeightUnit } from './WeightDisplay'

// Calcul pur : prix natif -> { native, converted } en texte. converted=null si pas de conversion.
// Reutilisable hors composant (ex: <option>, qui n'accepte que du texte).
export function formatPricePerWeight(
  price: number,
  currency: string,
  unit: WeightUnit,
  userCurrency?: string,
  userUnit?: WeightUnit,
  rates?: Record<string, number>,
): { native: string; converted: string | null } {
  const fmt = (val: number, cur: string) => {
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(val)
    } catch {
      return `${val.toFixed(2)} ${cur}`
    }
  }
  const needsCurrency = !!userCurrency && userCurrency !== currency && !!rates
  const needsUnit = !!userUnit && userUnit !== unit
  const native = `${fmt(price, currency)}/${unitLabel(unit)}`
  if (!needsCurrency && !needsUnit) return { native, converted: null }
  const targetCurrency = userCurrency ?? currency
  const targetUnit = userUnit ?? unit
  // 1) conversion devise (pivot EUR) ; 2) facteur prix/poids = convertWeight(1, cible, natif) (args INVERSES)
  const priceInTargetCurrency = needsCurrency && rates
    ? convertCurrency(price, currency, targetCurrency, rates)
    : price
  const altPrice = priceInTargetCurrency * convertWeight(1, targetUnit, unit)
  return { native, converted: `${fmt(altPrice, targetCurrency)}/${unitLabel(targetUnit)}` }
}

interface PricePerWeightDisplayProps {
  price: number | null
  currency: string          // devise native du trip
  unit: WeightUnit          // unite native du trip
  userCurrency?: string     // preference utilisateur
  userUnit?: WeightUnit     // preference utilisateur
  rates?: Record<string, number>  // taux depuis EUR
  style?: React.CSSProperties
}

export function PricePerWeightDisplay({
  price, currency, unit, userCurrency, userUnit, rates, style,
}: PricePerWeightDisplayProps) {
  if (price == null) {
    return (
      <span style={style}>
        <span style={{ fontWeight: 500, color: COLORS.charcoal }}>—</span>
      </span>
    )
  }

  const { native, converted } = formatPricePerWeight(price, currency, unit, userCurrency, userUnit, rates)

  return (
    <span style={style}>
      <span style={{ fontWeight: 500, color: COLORS.charcoal }}>{native}</span>
      {converted !== null && (
        <span style={{ fontSize: '0.85em', color: COLORS.charcoal2, marginLeft: 4 }}>
          ≃ {converted}
        </span>
      )}
    </span>
  )
}
