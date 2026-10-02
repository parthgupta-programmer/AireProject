import { useEffect, useRef, useState } from 'react'
import { getPrediction } from '@/services/predictionService'
import type { AqiPrediction } from '@/types/prediction'

interface State {
  /** `unavailable` = the model answered but has no estimate for this place. `error` = the request failed. */
  status: 'loading' | 'success' | 'error' | 'unavailable'
  prediction: AqiPrediction | null
}

/**
 * Latest model prediction for a location.
 * `refreshKey` (the current reading's timestamp) triggers a quiet re-fetch when fresh data arrives:
 * the prediction on screen stays put and only a change of location shows a skeleton.
 */
export function usePrediction(locationId: string | null, refreshKey?: string) {
  const [state, setState] = useState<State>({ status: 'loading', prediction: null })
  const [attempt, setAttempt] = useState(0)
  const loadedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    const isNewLocation = loadedFor.current !== locationId
    if (isNewLocation) setState({ status: 'loading', prediction: null })

    getPrediction(locationId)
      .then((prediction) => {
        if (cancelled) return
        loadedFor.current = locationId
        setState(prediction ? { status: 'success', prediction } : { status: 'unavailable', prediction: null })
      })
      .catch(() => {
        if (cancelled) return
        setState((s) => (!isNewLocation && s.prediction ? s : { status: 'error', prediction: null }))
      })
    return () => {
      cancelled = true
    }
  }, [locationId, refreshKey, attempt])

  return {
    ...state,
    retry: () => {
      loadedFor.current = null
      setAttempt((a) => a + 1)
    },
  }
}
