import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { DEFAULT_HORIZON_HOURS } from '@/config/prediction'
import { usePrediction } from '@/hooks/usePrediction'
import { pickHorizon } from '@/lib/prediction'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import type { AirQualityData } from '@/types/airQuality'
import { PredictionCard, PredictionCardSkeleton } from './PredictionCard'
import { PredictionChart, PredictionChartSkeleton } from './PredictionChart'
import { PredictionFactors, PredictionFactorsSkeleton } from './PredictionFactors'

/** Everything on the Insights page below the header: loads the prediction and picks the right state. */
export function PredictionSection({ current }: { current: AirQualityData }) {
  const { status, prediction, retry } = usePrediction(current.location.id, current.timestamp)
  const [chosen, setChosen] = useState<number | null>(null)

  if (status === 'loading') {
    return (
      <div role="status" aria-live="polite" className="grid gap-4 lg:grid-cols-12">
        <span className="sr-only">Loading prediction…</span>
        <PredictionCardSkeleton className="lg:order-1 lg:col-span-7" />
        <PredictionChartSkeleton className="lg:order-3 lg:col-span-12" />
        <PredictionFactorsSkeleton className="lg:order-2 lg:col-span-5" />
      </div>
    )
  }
  if (status === 'error') {
    return <ErrorState title="Prediction unavailable" description="Please try again." onRetry={retry} />
  }
  if (status === 'unavailable' || !prediction) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No prediction for this location yet"
        description="The model hasn’t produced an estimate here. Check back soon."
      />
    )
  }

  const horizon = pickHorizon(prediction.horizons, chosen, DEFAULT_HORIZON_HOURS)

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <PredictionCard
        prediction={prediction}
        horizon={horizon}
        currentAqi={current.aqi}
        onHorizonChange={setChosen}
        className="lg:order-1 lg:col-span-7"
      />
      <PredictionChart
        prediction={prediction}
        horizon={horizon}
        currentAqi={current.aqi}
        className="lg:order-3 lg:col-span-12"
      />
      <PredictionFactors factors={prediction.factors} className="lg:order-2 lg:col-span-5" />
    </div>
  )
}
