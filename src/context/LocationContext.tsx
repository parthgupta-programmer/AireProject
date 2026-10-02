import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { getDefaultLocation } from '@/services/airQualityService'
import type { LocationOption } from '@/types/airQuality'

const KEY = 'aire-location'

interface LocationCtx {
  location: LocationOption | null
  setLocation: (l: LocationOption) => void
}

const LocationContext = createContext<LocationCtx | null>(null)

function readStored(): LocationOption | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (p && typeof p.id === 'string' && typeof p.name === 'string') return p as LocationOption
    }
  } catch { /* storage unavailable or corrupted */ }
  return getDefaultLocation()
}

/** The selected location drives every data-backed page, so it lives above the router. */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<LocationOption | null>(readStored)

  const value = useMemo<LocationCtx>(
    () => ({
      location,
      setLocation: (l) => {
        setLocationState(l)
        try { localStorage.setItem(KEY, JSON.stringify(l)) } catch { /* ignore */ }
      },
    }),
    [location],
  )
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useSelectedLocation() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useSelectedLocation must be used inside LocationProvider')
  return ctx
}
