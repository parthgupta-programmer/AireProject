import { useAirQualityData } from '@/context/AirQualityContext'
import { useSelectedLocation } from '@/context/LocationContext'
import { LocationSelector } from '@/components/location/LocationSelector'
import { DataStatusNotice } from './DataStatusNotice'
import { LastUpdated } from './LastUpdated'
import { RefreshButton } from './RefreshButton'

/** Location, freshness and refresh: shared by every page that shows live data. */
export function AirQualityHeader({ title }: { title: string }) {
  const { location, setLocation } = useSelectedLocation()
  const { status, data, isRefreshing, refresh, retry } = useAirQualityData()

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="sr-only">{title}</h1>
          <LocationSelector value={location} onChange={setLocation} />
          {status === 'error' ? (
            <p className="mt-0.5 text-sm text-muted-foreground">Not updated</p>
          ) : (
            <LastUpdated timestamp={data?.timestamp} isRefreshing={isRefreshing} />
          )}
        </div>
        {location && <RefreshButton onClick={status === 'error' ? retry : refresh} isRefreshing={isRefreshing || status === 'loading'} />}
      </div>
      <span role="status" className="sr-only">
        {isRefreshing ? 'Refreshing air quality data' : ''}
      </span>
      <DataStatusNotice />
    </>
  )
}
