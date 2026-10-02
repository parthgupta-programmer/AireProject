import { AQI_BG, getAqiCategory } from '@/lib/aqi'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Color appears only as a small dot. The label stays in the normal text color for contrast.
export function AqiBadge({ aqi, className }: { aqi: number; className?: string }) {
  const cat = getAqiCategory(aqi)
  return (
    <Badge className={className}>
      <span aria-hidden className={cn('size-2 rounded-full', AQI_BG[cat.key])} />
      {cat.label}
    </Badge>
  )
}
