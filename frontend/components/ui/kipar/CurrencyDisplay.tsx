'use client'
import { COLORS } from '@/lib/theme'
import { useEffect, useState } from 'react'

interface CurrencyDisplayProps {
  amount: number
  currency: string        // devise native du trip
  userCurrency?: string   // preference utilisateur
  rates?: Record<string, number>
  style?: React.CSSProperties
}

export function CurrencyDisplay({
  amount,
  currency,
  userCurrency,
  rates,
  style,
}: CurrencyDisplayProps) {
  const showAlt = userCurrency && userCurrency !== currency && rates

  let altAmount: number | null = null
  if (showAlt && rates) {
    // Convertir via EUR comme pivot
    const eurAmount = currency === 'EUR' ? amount : amount / (rates[currency] ?? 1)
    altAmount = userCurrency === 'EUR' ? eurAmount : eurAmount * (rates[userCurrency!] ?? 1)
  }

  const formatAmount = (val: number, cur: string) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(val)

  // Si userCurrency defini, mettre en avant
  const primaryAmount = altAmount !== null ? altAmount : amount
  const primaryCurrency = altAmount !== null ? userCurrency! : currency
  const secondaryAmount = altAmount !== null ? amount : null
  const secondaryCurrency = altAmount !== null ? currency : null

  return (
    <span style={style}>
      <span style={{ fontWeight: 500, color: COLORS.charcoal }}>
        {formatAmount(primaryAmount, primaryCurrency)}
      </span>
      {secondaryAmount !== null && secondaryCurrency && (
        <span style={{ fontSize: '0.85em', color: COLORS.charcoal2, marginLeft: 4 }}>
          ({formatAmount(secondaryAmount, secondaryCurrency)})
        </span>
      )}
    </span>
  )
}
