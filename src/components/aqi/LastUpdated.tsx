import { TriangleAlert } from 'lucide-react'
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
  /** ISO time of the reading. Omit while the first load is in progress. */
  timestamp?: string
  isRefreshing?: boolean
}

export function LastUpdated({ timestamp, isRefreshing }: Props) {
  const now = useNow(30_000)
  if (!timestamp) return <Skeleton className="mt-1.5 h-4 w-36" />

  const age = Math.max(0, now - Date.parse(timestamp))
  const stale = age > STALE_AFTER_MS

  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>
        {isRefreshing ? (
          'Refreshing…'
        ) : (
          <>
            Updated{' '}
            <time dateTime={timestamp} title={new Date(timestamp).toLocaleString()}>
              {relative(age)}
            </time>
          </>
        )}
      </span>
      {stale && (
        <span className="inline-flex items-center gap-1 text-foreground">
          <TriangleAlert aria-hidden className="size-3.5" />
          Data may be outdated
        </span>
      )}
    </p>
  )
}
