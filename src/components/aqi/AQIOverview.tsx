import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { AQI_ADVICE, getAqiCategory, getAqiTrend, type AqiTrendDirection } from '@/lib/aqi'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { AirQualityData } from '@/types/airQuality'
import { AQIGauge } from './AQIGauge'

const TREND_UI: Record<AqiTrendDirection, { label: string; icon: typeof ArrowRight }> = {
  rising: { label: 'Worsening', icon: ArrowUpRight },
  falling: { label: 'Improving', icon: ArrowDownRight },
  steady: { label: 'Steady', icon: ArrowRight },
}

export function AQIOverview({ data, className }: { data: AirQualityData; className?: string }) {
  const cat = getAqiCategory(data.aqi)
  const trend = getAqiTrend(data.aqi, data.previousAqi)
  const ui = trend && TREND_UI[trend.direction]

  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col items-center justify-center gap-6 py-8 text-center sm:flex-row sm:gap-10 sm:px-8 sm:text-left">
        <AQIGauge aqi={data.aqi} className="shrink-0" />
        <div className="min-w-0 space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">{cat.label}</h2>
          <p className="text-base text-muted-foreground">{AQI_ADVICE[cat.key]}</p>
          {trend && ui && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
              <ui.icon className="size-4" aria-hidden />
              <span className="font-medium">{ui.label}</span>
              {trend.direction !== 'steady' && (
                <span className="text-muted-foreground">
                  {trend.delta > 0 ? '+' : '−'}
                  {Math.abs(trend.delta)}
                </span>
              )}
              <span className="text-muted-foreground">since last reading</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AQIOverviewSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardContent
        className={cn('flex h-full flex-col items-center justify-center gap-6 py-8 sm:flex-row sm:gap-10 sm:px-8')}
      >
        <Skeleton className="size-44 shrink-0 rounded-full sm:size-52" />
        <div className="w-full max-w-xs space-y-3">
          <Skeleton className="mx-auto h-9 w-32 sm:mx-0" />
          <Skeleton className="mx-auto h-5 w-56 max-w-full sm:mx-0" />
          <Skeleton className="mx-auto h-7 w-48 rounded-full sm:mx-0" />
        </div>
      </CardContent>
    </Card>
  )
}
