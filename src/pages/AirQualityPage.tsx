import { AirQualityBoundary } from '@/components/aqi/AirQualityBoundary'
import { AirQualityHeader } from '@/components/aqi/AirQualityHeader'
import { AQITrendChart, AQITrendSkeleton } from '@/components/aqi/AQITrendChart'
import { PollutantSummary, PollutantSummarySkeleton } from '@/components/aqi/PollutantSummary'

// The detailed view: same live data as Home, with every pollutant explained and the trend given more room.
export default function AirQualityPage() {
  return (
    <>
      <AirQualityHeader title="Air quality" />
      <AirQualityBoundary
        skeleton={
          <div className="grid gap-4 lg:grid-cols-12">
            <PollutantSummarySkeleton className="lg:col-span-5" />
            <AQITrendSkeleton className="lg:col-span-7" />
          </div>
        }
      >
        {(data) => (
          <div className="grid items-start gap-4 lg:grid-cols-12">
            <PollutantSummary pollutants={data.pollutants} defaultExpanded className="lg:col-span-5" />
            <AQITrendChart locationId={data.location.id} refreshKey={data.timestamp} className="lg:col-span-7" />
          </div>
        )}
      </AirQualityBoundary>
    </>
  )
}
