'use client'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface InsuranceConfig {
  enabled: boolean
  rate_type: 'percent' | 'fixed'
  rate_value: number
  min_premium: number
  max_coverage: number
  partner_name: string | null
}

export function useInsuranceConfig() {
  const { data } = useQuery<InsuranceConfig>({
    queryKey: ['insurance-config'],
    queryFn: async () => (await api.get('/insurance/config')).data,
    staleTime: 5 * 60 * 1000, // cache 5min
  })
  return data ?? { enabled: false, rate_type: 'percent' as const, rate_value: 0.03, min_premium: 2, max_coverage: 5000, partner_name: null }
}

export function calculateInsurancePremium(
  config: InsuranceConfig,
  declaredValue: number
): number {
  if (!config.enabled || declaredValue <= 0) return 0
  if (config.rate_type === 'fixed') return config.rate_value
  const premium = declaredValue * config.rate_value
  return Math.max(premium, config.min_premium)
}
