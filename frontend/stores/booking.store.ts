import { create } from 'zustand'

interface Trip {
  id: string
  origin_city: string
  origin_airport_code: string
  destination_city: string
  destination_airport_code: string
  departure_date: string
  flight_number: string | null
  total_kg: number
  remaining_kg: number
  max_kg_per_package: number
  price_per_kg: number
  status: string
  trust_score?: number
}

interface BookingStore {
  selectedTrip: Trip | null
  currentBookingId: string | null
  setSelectedTrip: (trip: Trip) => void
  setCurrentBookingId: (id: string) => void
  clear: () => void
}

export const useBookingStore = create<BookingStore>((set) => ({
  selectedTrip: null,
  currentBookingId: null,
  setSelectedTrip: (trip) => set({ selectedTrip: trip }),
  setCurrentBookingId: (id) => set({ currentBookingId: id }),
  clear: () => set({ selectedTrip: null, currentBookingId: null }),
}))
