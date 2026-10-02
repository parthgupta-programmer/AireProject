import { AirQualityBoundary } from '@/components/aqi/AirQualityBoundary'
import { AirQualityHeader } from '@/components/aqi/AirQualityHeader'
import { AQIOverview, AQIOverviewSkeleton } from '@/components/aqi/AQIOverview'
import { AQITrendChart, AQITrendSkeleton } from '@/components/aqi/AQITrendChart'
import { PollutantSummary, PollutantSummarySkeleton } from '@/components/aqi/PollutantSummary'

export default function HomePage() {
  return (
    <>
      <AirQualityHeader title="Overview" />
      <AirQualityBoundary
        skeleton={
          <div className="grid gap-4 lg:grid-cols-12">
            <AQIOverviewSkeleton className="lg:col-span-7" />
            <PollutantSummarySkeleton className="lg:col-span-5" />
            <AQITrendSkeleton className="lg:col-span-12" />
          </div>
        }
      >
        {(data) => (
          <div className="grid gap-4 lg:grid-cols-12">
            <AQIOverview data={data} className="lg:col-span-7" />
            <PollutantSummary pollutants={data.pollutants} className="lg:col-span-5" />
            <AQITrendChart locationId={data.location.id} refreshKey={data.timestamp} className="lg:col-span-12" />
          </div>
        )}
      </AirQualityBoundary>
    </>
  )
}
