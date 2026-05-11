'use client'
import { COLORS } from '@/lib/theme'

interface CurrencyDisplayProps {
  amount: number
  currency: string        // devise native du trip (toujours affichee en premier)
  userCurrency?: string   // preference utilisateur (pour la conversion)
  rates?: Record<string, number>  // taux depuis EUR
  perUnit?: string  // ex: 'kg', 'lb' pour afficher /unite apres conversion
  style?: React.CSSProperties
}

export function CurrencyDisplay({ amount, currency, userCurrency, rates, perUnit, style }: CurrencyDisplayProps) {
  const needsConversion = userCurrency && userCurrency !== currency && rates

  let altAmount: number | null = null
  if (needsConversion && rates) {
    // Conversion via EUR comme pivot
    const inEur = currency === 'EUR' ? amount : amount / (rates[currency] ?? 1)
    altAmount = userCurrency === 'EUR' ? inEur : inEur * (rates[userCurrency!] ?? 1)
  }

  const fmt = (val: number, cur: string) => {
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: cur, maximumFractionDigits: 0
      }).format(Math.ceil(val))
    } catch {
      return `${Math.ceil(val)} ${cur}`
    }
  }

  return (
    <span style={style}>
      <span style={{ fontWeight: 500, color: COLORS.charcoal }}>
        {fmt(amount, currency)}
      </span>
      {altAmount !== null && perUnit && (
        <span style={{ fontSize: '0.85em', color: COLORS.charcoal2, marginLeft: 4 }}>
          ≃ {fmt(altAmount, userCurrency!)}/{perUnit}
        </span>
      )}
      {altAmount !== null && !perUnit && (
        <span style={{ fontSize: '0.85em', color: COLORS.charcoal2, marginLeft: 4 }}>
          ≃ {fmt(altAmount, userCurrency!)}
        </span>
      )}
    </span>
  )
}
