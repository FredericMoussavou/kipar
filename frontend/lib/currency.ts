import api from '@/lib/api'

export interface ExchangeRates {
  base: string
  rates: Record<string, number>
  supported_currencies: string[]
}

export const SUPPORTED_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'XOF', 'XAF', 'MAD', 'TND', 'DZD',
  'NGN', 'GHS', 'KES', 'ZAR', 'CAD', 'CHF', 'JPY', 'CNY', 'BRL'
]

export const WEIGHT_UNITS = [
  { value: 'kg', label: 'Kilogrammes (kg)' },
  { value: 'lb', label: 'Livres (lb)' },
]

let _ratesCache: ExchangeRates | null = null
let _cacheTime: number | null = null
const CACHE_MS = 1000 * 60 * 60 // 1h cote client

export async function getExchangeRates(base = 'EUR'): Promise<ExchangeRates> {
  const now = Date.now()
  if (_ratesCache && _cacheTime && (now - _cacheTime) < CACHE_MS) {
    return _ratesCache
  }
  const res = await api.get<ExchangeRates>(`/currencies/rates?base=${base}`)
  _ratesCache = res.data
  _cacheTime = now
  return res.data
}

export async function getPriceSuggestion(origin: string, destination: string) {
  const res = await api.get<{
    corridor: string
    price_low: number | null
    price_high: number | null
    sample_count: number
    is_corridor_data: boolean
    note?: string
  }>(`/trips/price-suggestion?origin=${origin}&destination=${destination}`)
  return res.data
}
