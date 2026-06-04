'use client'
import { COLORS } from '@/lib/theme'

interface CurrencyDisplayProps {
  amount: number
  currency: string        // devise native du trip (toujours affichee en premier)
  userCurrency?: string   // preference utilisateur (pour la conversion)
  rates?: Record<string, number>  // taux depuis EUR
  exact?: boolean  // montants exacts (paiement) : 2 decimales, pas d'arrondi
  style?: React.CSSProperties
}

// Conversion de devise via EUR comme pivot — exportee pour reutilisation (PricePerWeightDisplay)
export function convertCurrency(amount: number, from: string, to: string, rates: Record<string, number>): number {
  const inEur = from === 'EUR' ? amount : amount / (rates[from] ?? 1)
  return to === 'EUR' ? inEur : inEur * (rates[to] ?? 1)
}

export function CurrencyDisplay({ amount, currency, userCurrency, rates, exact, style }: CurrencyDisplayProps) {
  const needsConversion = userCurrency && userCurrency !== currency && rates

  let altAmount: number | null = null
  if (needsConversion && rates) {
    altAmount = convertCurrency(amount, currency, userCurrency!, rates)
  }

  const fmt = (val: number, cur: string) => {
    const v = exact ? val : Math.ceil(val)
    const opts: Intl.NumberFormatOptions = exact
      ? { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { style: 'currency', currency: cur, maximumFractionDigits: 0 }
    try {
      return new Intl.NumberFormat('fr-FR', opts).format(v)
    } catch {
      return exact ? `${v.toFixed(2)} ${cur}` : `${v} ${cur}`
    }
  }

  return (
    <span style={style}>
      <span style={{ fontWeight: 500, color: COLORS.charcoal }}>
        {fmt(amount, currency)}
      </span>
      {altAmount !== null && (
        <span style={{ fontSize: '0.85em', color: COLORS.charcoal2, marginLeft: 4 }}>
          ≃ {fmt(altAmount, userCurrency!)}
        </span>
      )}
    </span>
  )
}
