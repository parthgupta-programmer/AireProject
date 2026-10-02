import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function RefreshButton({ onClick, isRefreshing }: { onClick: () => void; isRefreshing: boolean }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isRefreshing}
      aria-label="Refresh air quality data"
      className="shrink-0"
    >
      <RotateCw aria-hidden className={cn('size-3.5', isRefreshing && 'animate-spin')} />
      <span className="hidden sm:inline">Refresh</span>
    </Button>
  )
}
