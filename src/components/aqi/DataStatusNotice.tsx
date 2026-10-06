import { CloudOff, WifiOff } from 'lucide-react'
import { useAirQualityData } from '@/context/AirQualityContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { Button } from '@/components/ui/button'

/** One quiet line that appears only when the data on screen is not being kept fresh. */
export function DataStatusNotice() {
  const { data, refreshFailed, isRefreshing, refresh } = useAirQualityData()
  const online = useOnlineStatus()
  if (!data || (online && !refreshFailed)) return null

  const Icon = online ? CloudOff : WifiOff
  return (
    <div role="status" className="mb-4 flex items-center justify-between gap-3 app-glass rounded-2xl px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2">
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        {online ? 'Couldn’t refresh. Showing the last reading.' : 'You’re offline. Showing the last reading.'}
      </span>
      {online && (
        <Button variant="ghost" size="sm" onClick={refresh} disabled={isRefreshing}>
          Retry
        </Button>
      )}
    </div>
  )
}
