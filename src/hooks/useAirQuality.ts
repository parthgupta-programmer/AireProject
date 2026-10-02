import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { REFRESH_INTERVAL_MS } from '@/config/airQuality'
import { getCurrentAirQuality } from '@/services/airQualityService'
import type { AirQualityData } from '@/types/airQuality'

interface State {
  status: 'loading' | 'success' | 'error'
  data: AirQualityData | null
  /** A background or manual refresh is in flight. Existing data stays on screen. */
  isRefreshing: boolean
  /** The last refresh failed but older data is still being shown. */
  refreshFailed: boolean
}

const INITIAL: State = { status: 'loading', data: null, isRefreshing: false, refreshFailed: false }

/**
 * Current air quality for one location, kept fresh.
 *  - loads on mount and whenever the location changes
 *  - refreshes every 5 minutes while the tab is visible
 *  - refreshes when the tab becomes visible again (if the data is old) and when the connection returns
 *  - a failed refresh never wipes good data; it just sets `refreshFailed`
 */
export function useAirQuality(locationId: string | null) {
  const [state, setState] = useState<State>(INITIAL)
  const requestId = useRef(0)
  const latest = useRef<AirQualityData | null>(null)

  useEffect(() => {
    latest.current = state.data
  }, [state.data])

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!locationId) return
      const id = ++requestId.current // only the newest request may update state
      setState((s) => (mode === 'initial' ? INITIAL : { ...s, isRefreshing: true }))
      try {
        const data = await getCurrentAirQuality(locationId)
        if (id !== requestId.current) return
        setState({ status: 'success', data, isRefreshing: false, refreshFailed: false })
      } catch {
        if (id !== requestId.current) return
        setState((s) =>
          s.data
            ? { ...s, isRefreshing: false, refreshFailed: true }
            : { ...INITIAL, status: 'error' },
        )
      }
    },
    [locationId],
  )

  useEffect(() => {
    if (!locationId) return
    void load('initial')

    const timer = setInterval(() => {
      if (!document.hidden) void load('refresh')
    }, REFRESH_INTERVAL_MS)

    const onVisible = () => {
      const ts = latest.current?.timestamp
      if (!document.hidden && ts && Date.now() - Date.parse(ts) > REFRESH_INTERVAL_MS) void load('refresh')
    }
    const onOnline = () => void load('refresh')

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      requestId.current++ // drop any in-flight response
    }
  }, [locationId, load])

  const refresh = useCallback(() => load('refresh'), [load])
  const retry = useCallback(() => load('initial'), [load])

  return useMemo(() => ({ ...state, refresh, retry }), [state, refresh, retry])
}

export type AirQualityState = ReturnType<typeof useAirQuality>
