import { Sparkles, TriangleAlert } from 'lucide-react'
import { PREDICTION_STALE_AFTER_MS } from '@/config/prediction'
import { useNow } from '@/hooks/useNow'
import { getAqiCategory } from '@/lib/aqi'
import { formatHorizon, getConfidenceLevel, getPredictionPhrase, horizonShortLabel } from '@/lib/prediction'
import { AqiBadge } from '@/components/aqi/AqiBadge'
import { Badge } from '@/components/ui/badge'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import type { AqiPrediction, PredictionHorizon } from '@/types/prediction'

interface Props {
  prediction: AqiPrediction
  horizon: PredictionHorizon
  currentAqi: number
  onHorizonChange: (hours: number) => void
  className?: string
}

function minutesAgo(iso: string, now: number) {
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : `${Math.floor(min / 60)} h ago`
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  )
}

export function PredictionCard({ prediction, horizon, currentAqi, onHorizonChange, className }: Props) {
  const now = useNow(30_000)
  const cat = getAqiCategory(horizon.aqi)
  const stale = now - Date.parse(prediction.generatedAt) > PREDICTION_STALE_AFTER_MS
  const target = new Date(horizon.targetTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <Card className={`border-ring/30 ${className ?? ''}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <Badge variant="primary">
          <Sparkles aria-hidden className="size-3" />
          AI prediction
        </Badge>
        {prediction.horizons.length > 1 && (
          <SegmentedControl
            label="Prediction horizon"
            options={prediction.horizons.map((h) => ({ value: String(h.hours), label: horizonShortLabel(h.hours) }))}
            value={String(horizon.hours)}
            onChange={(v) => onHorizonChange(Number(v))}
          />
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">{getPredictionPhrase(currentAqi, horizon.aqi)}</p>
          <p className="mt-1 flex items-baseline gap-3">
            <AnimatedNumber value={horizon.aqi} className="text-6xl font-semibold leading-none tracking-tight" />
            <span className="text-2xl font-semibold tracking-tight">{cat.label}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            around {target}. Model estimate for the next {formatHorizon(horizon.hours)}.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-4 border-t pt-4">
          <Fact label="Now">
            <span className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
              {currentAqi}
              <AqiBadge aqi={currentAqi} />
            </span>
          </Fact>
          <Fact label="Likely range">
            {horizon.low !== undefined && horizon.high !== undefined ? `${horizon.low}–${horizon.high}` : '—'}
          </Fact>
          <Fact label="Confidence">
            {horizon.confidence === undefined ? (
              <span className="font-normal text-muted-foreground">Not provided</span>
            ) : (
              <>
                {Math.round(horizon.confidence * 100)}%{' '}
                <span className="font-normal text-muted-foreground">{getConfidenceLevel(horizon.confidence)}</span>
              </>
            )}
          </Fact>
        </dl>

        <div className="space-y-2 border-t pt-4">
          {prediction.insight && <p className="text-sm">{prediction.insight}</p>}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              Generated <time dateTime={prediction.generatedAt}>{minutesAgo(prediction.generatedAt, now)}</time>
            </span>
            <span>Estimates can be wrong.</span>
            {stale && (
              <span className="inline-flex items-center gap-1 text-foreground">
                <TriangleAlert aria-hidden className="size-3.5" />
                May be outdated
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function PredictionCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-8 w-36" />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-14 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  )
}
