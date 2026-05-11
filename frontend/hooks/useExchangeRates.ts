'use client'
import { useState, useEffect } from 'react'
import { getExchangeRates } from '@/lib/currency'

let _cache: Record<string, number> | null = null

export function useExchangeRates() {
  const [rates, setRates] = useState<Record<string, number> | null>(_cache)

  useEffect(() => {
    if (_cache) return
    getExchangeRates().then(r => {
      _cache = r.rates
      setRates(r.rates)
    }).catch(() => {})
  }, [])

  return rates
}
