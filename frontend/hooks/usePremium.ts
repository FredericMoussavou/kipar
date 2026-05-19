'use client'

import { useAuthStore } from '@/stores/auth.store'

export function usePremium() {
  const { user } = useAuthStore()

  const isPremium = (): boolean => {
    if (!user?.is_premium) return false
    if (user?.premium_expires_at) {
      return new Date(user.premium_expires_at) > new Date()
    }
    return true
  }

  const limits = {
    activeBookings: isPremium() ? null : 3,
    activeTrips: isPremium() ? null : 2,
    activeRequests: isPremium() ? null : 2,
    photosPerPackage: isPremium() ? 5 : 2,
    kiparScanMonthly: isPremium() ? null : 3,
    flightTracking: isPremium(),
    arrivalReminder: isPremium(),
    financeExport: isPremium(),
    premiumBadge: isPremium(),
    fullReviewHistory: isPremium(),
    prioritySupport: isPremium(),
  }

  return { isPremium: isPremium(), limits }
}