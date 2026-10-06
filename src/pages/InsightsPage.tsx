import { AirQualityBoundary } from '@/components/aqi/AirQualityBoundary'
import { AirQualityHeader } from '@/components/aqi/AirQualityHeader'
import { PredictionCardSkeleton } from '@/components/prediction/PredictionCard'
import { PredictionChartSkeleton } from '@/components/prediction/PredictionChart'
import { PredictionFactorsSkeleton } from '@/components/prediction/PredictionFactors'
import { PredictionSection } from '@/components/prediction/PredictionSection'

export default function InsightsPage() {
  return (
    <>
      <AirQualityHeader title="Insights" />
      <AirQualityBoundary
        skeleton={
          <div className="grid gap-4 lg:grid-cols-12">
            <PredictionCardSkeleton className="lg:order-1 lg:col-span-7" />
            <PredictionChartSkeleton className="lg:order-3 lg:col-span-12" />
            <PredictionFactorsSkeleton className="lg:order-2 lg:col-span-5" />
          </div>
        }
      >
        {(data) => <PredictionSection current={data} />}
      </AirQualityBoundary>
    </>
  )
}
