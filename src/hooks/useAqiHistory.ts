import { useEffect, useState } from 'react'
import { getAqiHistory } from '@/services/airQualityService'
import type { AqiHistory, HistoryRange } from '@/types/airQuality'

interface State {
  status: 'loading' | 'success' | 'error'
  history: AqiHistory | null
}

/**
 * Observed AQI for a location and range.
 * `refreshKey` (the current reading's timestamp) re-fetches quietly when new data arrives:
 * the chart stays on screen and only a change of location or range shows a skeleton.
 */
export function useAqiHistory(locationId: string | null, range: HistoryRange, refreshKey?: string) {
  const [state, setState] = useState<State>({ status: 'loading', history: null })
  const [attempt, setAttempt] = useState(0)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const key = `${locationId}:${range}`

  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    const isNewView = loadedKey !== key
    if (isNewView) setState({ status: 'loading', history: null })

    getAqiHistory(locationId, range)
      .then((history) => {
        if (cancelled) return
        setLoadedKey(key)
        setState({ status: 'success', history })
      })
      .catch(() => {
        if (cancelled) return
        setState((s) => (isNewView || !s.history ? { status: 'error', history: null } : s))
      })
    return () => {
      cancelled = true
    }
    // loadedKey is intentionally read but not a trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, range, refreshKey, attempt])

  return { ...state, retry: () => { setLoadedKey(null); setAttempt((a) => a + 1) } }
}
