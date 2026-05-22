import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export type LimitsData = {
  is_premium: boolean
  bookings: { current: number; max: number | null }
  trips: { current: number; max: number | null }
  requests: { current: number; max: number | null }
}

export function useLimits() {
  const { data, isLoading } = useQuery<LimitsData>({
    queryKey: ['limits'],
    queryFn: async () => (await api.get('/users/me/limits')).data,
    staleTime: 30_000,
  })
  return {
    limits: data,
    isLoading,
    tripsBlocked: !data?.is_premium && (data?.trips.current ?? 0) >= (data?.trips.max ?? 2),
    bookingsBlocked: !data?.is_premium && (data?.bookings.current ?? 0) >= (data?.bookings.max ?? 3),
    requestsBlocked: !data?.is_premium && (data?.requests.current ?? 0) >= (data?.requests.max ?? 2),
  }
}
