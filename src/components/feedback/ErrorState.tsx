import { CircleAlert, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Couldn’t load data',
  description = 'Check your connection and try again.',
  onRetry,
  className,
}: Props) {
  return (
    <div role="alert" className={cn('app-glass flex flex-col items-center rounded-2xl px-6 py-14 text-center', className)}>
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-aqi-very-poor/15 text-aqi-very-poor"><CircleAlert className="size-5" aria-hidden /></span>
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw className="size-3.5" aria-hidden /> Retry
        </Button>
      )}
    </div>
  )
}
