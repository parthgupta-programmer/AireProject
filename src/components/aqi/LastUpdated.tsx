import { TriangleAlert, Radio } from 'lucide-react'
import { STALE_AFTER_MS } from '@/config/airQuality'
import { useNow } from '@/hooks/useNow'
import { Skeleton } from '@/components/ui/skeleton'

function relative(ms: number) {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`
}

interface Props {
  /** ISO time of the reading from provider. */
  timestamp?: string
  /** ISO time when the client last fetched/synced the data. */
  fetchedAt?: string
  isRefreshing?: boolean
}

export function LastUpdated({ timestamp, fetchedAt, isRefreshing }: Props) {
  const now = useNow(15_000)
  if (!timestamp) return <Skeleton className="mt-1.5 h-4 w-36" />

  const stationAge = Math.max(0, now - Date.parse(timestamp))
  const syncAge = fetchedAt ? Math.max(0, now - Date.parse(fetchedAt)) : 0
  const stale = stationAge > STALE_AFTER_MS

  const formattedStationTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
      {isRefreshing ? (
        <span className="inline-flex items-center gap-1.5 text-primary animate-pulse font-medium">
          <Radio className="size-3.5" aria-hidden />
          Updating…
        </span>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Synced {relative(syncAge)}
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span>
            Station reading:{' '}
            <time dateTime={timestamp} title={new Date(timestamp).toLocaleString()} className="font-medium text-foreground/80">
              {formattedStationTime} ({relative(stationAge)})
            </time>
          </span>
        </div>
      )}

      {stale && (
        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium text-xs">
          <TriangleAlert aria-hidden className="size-3.5" />
          Station data delayed (&gt;90m)
        </span>
      )}
    </div>
  )
}
