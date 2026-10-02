import { createContext, useContext, type ReactNode } from 'react'
import { useAirQuality, type AirQualityState } from '@/hooks/useAirQuality'
import { useSelectedLocation } from './LocationContext'

const AirQualityContext = createContext<AirQualityState | null>(null)

/**
 * Runs the live-data hook once for the whole app, so the 5-minute refresh keeps going while the
 * user moves between pages and each page shows data instantly instead of reloading.
 */
export function AirQualityProvider({ children }: { children: ReactNode }) {
  const { location } = useSelectedLocation()
  const value = useAirQuality(location?.id ?? null)
  return <AirQualityContext.Provider value={value}>{children}</AirQualityContext.Provider>
}

export function useAirQualityData() {
  const ctx = useContext(AirQualityContext)
  if (!ctx) throw new Error('useAirQualityData must be used inside AirQualityProvider')
  return ctx
}
