'use client'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface AppConfig {
  fees: {
    service_fee_sender_percent: number
    booking_flat_fee: number
    urgent_flat_fee: number
    min_commission: number
  }
  small_package: {
    max_kg: number
    kipar_fee: number
    carrier_min: number
    carrier_max: number
  }
  trip: {
    publish_urgent_min_hours: number
    publish_normal_min_hours: number
  }
  booking: {
    urgent_threshold_hours: number
    min_hours_before_departure: number
    max_evidence_files: number
  }
  insurance: {
    enabled: boolean
    rate_type: 'percent' | 'fixed'
    rate_value: number
    self_cover_max: number
  }
}

// Valeurs de repli alignees sur config.py (utilisees tant que le fetch n'a pas repondu)
const DEFAULT_CONFIG: AppConfig = {
  fees: { service_fee_sender_percent: 0.15, booking_flat_fee: 1.5, urgent_flat_fee: 10.0, min_commission: 2.5 },
  small_package: { max_kg: 1.0, kipar_fee: 5.0, carrier_min: 5.0, carrier_max: 10.0 },
  trip: { publish_urgent_min_hours: 72.0, publish_normal_min_hours: 168.0 },
  booking: { urgent_threshold_hours: 36.0, min_hours_before_departure: 5.0, max_evidence_files: 5 },
  insurance: { enabled: false, rate_type: 'percent', rate_value: 0.03, self_cover_max: 200.0 },
}

export function useConfig(): AppConfig {
  const { data } = useQuery<AppConfig>({
    queryKey: ['app-config'],
    queryFn: async () => (await api.get('/config')).data,
    staleTime: 10 * 60 * 1000, // cache 10min
  })
  return data ?? DEFAULT_CONFIG
}
