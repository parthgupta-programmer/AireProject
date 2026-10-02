import { useCallback, useEffect, useRef, useState } from 'react'
import { getNationalAirQuality } from '@/services/airQualityService'
import type { CityAqi } from '@/types/airQuality'

/** How often the map asks for new readings while the tab is visible. */
export const MAP_POLL_MS = 60_000

interface State {
  status: 'loading' | 'success' | 'error'
  cities: CityAqi[]
  /** When the cities were last fetched successfully (ms since epoch). */
  updatedAt: number | null
  isRefreshing: boolean
}

/**
 * Current AQI of every monitored Indian city, kept live:
 *  - refreshes every minute while the tab is visible
 *  - refreshes when the tab becomes visible again and when the connection returns
 *  - a failed refresh never wipes the data already on the map
 * `refreshKey` (the selected city's reading timestamp) also triggers a refresh.
 */
export function useNationalAqi(refreshKey?: string) {
  const [state, setState] = useState<State>({ status: 'loading', cities: [], updatedAt: null, isRefreshing: false })
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setState((s) => ({ ...s, isRefreshing: s.status === 'success' }))
    try {
      const cities = await getNationalAirQuality()
      if (id === requestId.current) setState({ status: 'success', cities, updatedAt: Date.now(), isRefreshing: false })
    } catch {
      if (id === requestId.current)
        setState((s) => (s.cities.length ? { ...s, isRefreshing: false } : { ...s, status: 'error', isRefreshing: false }))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && void load()
    const timer = window.setInterval(tick, MAP_POLL_MS)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('online', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('online', tick)
    }
  }, [load])

  const retry = useCallback(() => {
    setState({ status: 'loading', cities: [], updatedAt: null, isRefreshing: false })
    void load()
  }, [load])

  return { ...state, retry }
}
