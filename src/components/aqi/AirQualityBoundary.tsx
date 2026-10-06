import type { ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import { useAirQualityData } from '@/context/AirQualityContext'
import { useSelectedLocation } from '@/context/LocationContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import type { AirQualityData } from '@/types/airQuality'

interface Props {
  /** Shown while loading. Should match the loaded layout to avoid jumps. */
  skeleton: ReactNode
  children: (data: AirQualityData) => ReactNode
}

/** Decides between: no location, loading, error, or content. Pages only describe the happy path. */
export function AirQualityBoundary({ skeleton, children }: Props) {
  const { location } = useSelectedLocation()
  const { status, data, retry } = useAirQualityData()
  const online = useOnlineStatus()

  if (!location) {
    return <EmptyState icon={MapPin} title="Choose a location" description="Pick a place to see its air quality." />
  }
  if (status === 'error') {
    return (
      <ErrorState
        title="Air quality data unavailable"
        description={online ? 'Please try again.' : 'You’re offline. Check your connection.'}
        onRetry={retry}
      />
    )
  }
  if (status === 'loading' || !data) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading air quality…</span>
        {skeleton}
      </div>
    )
  }
  return <>{children(data)}</>
}
