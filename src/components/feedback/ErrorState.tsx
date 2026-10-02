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
    <div role="alert" className={cn('flex flex-col items-center rounded-lg border px-6 py-12 text-center', className)}>
      <CircleAlert className="mb-3 size-5 text-aqi-very-poor" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw className="size-3.5" aria-hidden /> Retry
        </Button>
      )}
    </div>
  )
}
