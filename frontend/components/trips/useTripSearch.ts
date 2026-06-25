'use client'
import { useState, useCallback } from 'react'
import type { AirportSuggestion } from '@/components/trips/AirportInput'

export interface UseTripSearchOptions {
  // recuperation des trajets : prive (api.get+token) | public (fetch sans token)
  fetchTrips: (params: URLSearchParams) => Promise<any[]>
  // recherche d'aeroports : renvoie une liste {code, city}
  searchAirports: (q: string) => Promise<AirportSuggestion[]>
  pageSize?: number
}

export interface TripSearchState {
  origin: string
  dest: string
  date: string
  sortBy: string
  setDate: (v: string) => void
  setSortBy: (v: string) => void
  originSuggestions: AirportSuggestion[]
  destSuggestions: AirportSuggestion[]
  trips: any[]
  isLoading: boolean
  searched: boolean
  hasMore: boolean
  handleSearch: () => void
  handleLoadMore: () => void
  // props prets a etaler dans <AirportInput .../>
  originProps: {
    value: string
    suggestions: AirportSuggestion[]
    onChange: (v: string) => void
    onSelect: (a: AirportSuggestion) => void
    onClear: () => void
  }
  destProps: {
    value: string
    suggestions: AirportSuggestion[]
    onChange: (v: string) => void
    onSelect: (a: AirportSuggestion) => void
    onClear: () => void
  }
}

export function useTripSearch({ fetchTrips, searchAirports, pageSize = 20 }: UseTripSearchOptions): TripSearchState {
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [date, setDate] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [originSuggestions, setOriginSuggestions] = useState<AirportSuggestion[]>([])
  const [destSuggestions, setDestSuggestions] = useState<AirportSuggestion[]>([])

  const [trips, setTrips] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const buildParams = useCallback((nextOffset: number) => {
    const params = new URLSearchParams()
    if (origin) params.set('origin', origin)
    if (dest) params.set('destination', dest)
    if (date) params.set('date', date)
    if (sortBy) params.set('sort_by', sortBy)
    params.set('limit', String(pageSize))
    params.set('offset', String(nextOffset))
    return params
  }, [origin, dest, date, sortBy, pageSize])

  const runSearch = useCallback(async (nextOffset: number, append: boolean) => {
    setIsLoading(true)
    try {
      const data = await fetchTrips(buildParams(nextOffset))
      const list = Array.isArray(data) ? data : []
      setTrips(prev => (append ? [...prev, ...list] : list))
      setHasMore(list.length === pageSize)
      setOffset(nextOffset)
    } catch {
      if (!append) setTrips([])
      setHasMore(false)
    } finally {
      setIsLoading(false)
    }
  }, [fetchTrips, buildParams, pageSize])

  const handleSearch = useCallback(() => {
    setSearched(true)
    setOriginSuggestions([])
    setDestSuggestions([])
    runSearch(0, false)
  }, [runSearch])

  const handleLoadMore = useCallback(() => {
    runSearch(offset + pageSize, true)
  }, [runSearch, offset, pageSize])

  const onAirportQuery = useCallback(async (q: string, which: 'origin' | 'dest') => {
    const setter = which === 'origin' ? setOriginSuggestions : setDestSuggestions
    if (q.length < 1) { setter([]); return }
    try {
      const res = await searchAirports(q)
      setter(res || [])
    } catch {
      setter([])
    }
  }, [searchAirports])

  const originProps = {
    value: origin,
    suggestions: originSuggestions,
    onChange: (v: string) => { setOrigin(v); onAirportQuery(v, 'origin') },
    onSelect: (a: AirportSuggestion) => { setOrigin(a.code); setOriginSuggestions([]) },
    onClear: () => { setOrigin(''); setOriginSuggestions([]) },
  }
  const destProps = {
    value: dest,
    suggestions: destSuggestions,
    onChange: (v: string) => { setDest(v); onAirportQuery(v, 'dest') },
    onSelect: (a: AirportSuggestion) => { setDest(a.code); setDestSuggestions([]) },
    onClear: () => { setDest(''); setDestSuggestions([]) },
  }

  return {
    origin, dest, date, sortBy, setDate, setSortBy,
    originSuggestions, destSuggestions,
    trips, isLoading, searched, hasMore,
    handleSearch, handleLoadMore,
    originProps, destProps,
  }
}