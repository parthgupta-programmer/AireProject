/**
 * Prediction service (MOCK ML backend).
 *
 * To connect the real model: keep `getPrediction`, replace the body with a fetch() to your backend and map the
 * response to `AqiPrediction`. Return `null` when the model has no estimate for the location.
 *
 * The mock builds a plausible hourly forecast from the same underlying data the dashboard uses, adds an
 * uncertainty band that widens with time, and lets confidence fall as the horizon grows.
 */
import { mockDataForPrediction } from './airQualityService'
import { FLAG, MockRequestError, rand01, simulateNetwork } from './mock'
import type { AqiPrediction, PredictionFactor, PredictionHorizon, PredictionPoint } from '@/types/prediction'

const HOUR = 3_600_000
const MAX_HOURS = 24
const HORIZON_HOURS = [3, 6, 12, 24]

const round = (n: number) => Math.round(n)

function factorsFor(delta: number): PredictionFactor[] {
  if (delta > 5) {
    return [
      { id: 'traffic', label: 'Rush-hour traffic', impact: 'raises', weight: 0.34, detail: 'Vehicle emissions build up.' },
      { id: 'wind', label: 'Light winds', impact: 'raises', weight: 0.28, detail: 'Pollutants are not dispersing.' },
      { id: 'pm25', label: 'Recent PM2.5 rise', impact: 'raises', weight: 0.24, detail: 'Fine particles climbed in recent hours.' },
      { id: 'mixing', label: 'Daytime mixing', impact: 'lowers', weight: 0.14, detail: 'Warmer air lifts and dilutes pollution.' },
    ]
  }
  if (delta < -5) {
    return [
      { id: 'wind', label: 'Stronger winds', impact: 'lowers', weight: 0.36, detail: 'Pollutants disperse faster.' },
      { id: 'mixing', label: 'Warmer air', impact: 'lowers', weight: 0.27, detail: 'Pollution mixes higher up.' },
      { id: 'traffic', label: 'Lower traffic', impact: 'lowers', weight: 0.22, detail: 'Fewer vehicles on the road.' },
      { id: 'background', label: 'Regional background', impact: 'raises', weight: 0.15, detail: 'Pollution drifting in from nearby.' },
    ]
  }
  return [
    { id: 'wind', label: 'Steady winds', impact: 'neutral', weight: 0.3, detail: 'Dispersion stays about the same.' },
    { id: 'traffic', label: 'Moderate traffic', impact: 'neutral', weight: 0.3, detail: 'No major change in emissions.' },
    { id: 'pm25', label: 'Stable PM2.5', impact: 'neutral', weight: 0.25, detail: 'Fine particles are holding level.' },
    { id: 'background', label: 'Regional background', impact: 'raises', weight: 0.15, detail: 'A small contribution from nearby areas.' },
  ]
}

export async function getPrediction(locationId: string): Promise<AqiPrediction | null> {
  await simulateNetwork(500) // models are slower than a plain lookup
  if (FLAG === 'predicterror') throw new MockRequestError('Mock prediction failed')
  if (FLAG === 'nopredict') return null

  const latest = mockDataForPrediction.latestMeasurementTime()
  const anchor = FLAG === 'predictstale' ? latest - 25 * 60_000 : latest
  const current = mockDataForPrediction.aqiAt(locationId, anchor)
  if (current === undefined) throw new MockRequestError('Unknown location')

  const seed = Math.floor(anchor / HOUR) + locationId.length * 131

  const series: PredictionPoint[] = Array.from({ length: MAX_HOURS + 1 }, (_, h) => {
    const t = anchor + h * HOUR
    if (h === 0) return { timestamp: new Date(t).toISOString(), aqi: current, low: current, high: current }
    const truth = (mockDataForPrediction.aqiAt(locationId, t) ?? current) * (1 + 0.05 * (rand01(seed + h * 53) * 2 - 1))
    const blend = Math.min(1, h / 3) // start from what we measure, drift toward the model's view
    const aqi = round(current * (1 - blend) + truth * blend)
    const half = aqi * (0.05 + 0.011 * h)
    return { timestamp: new Date(t).toISOString(), aqi, low: round(aqi - half), high: round(aqi + half) }
  })

  const horizons: PredictionHorizon[] = HORIZON_HOURS.map((hours) => {
    const p = series[hours]
    return {
      hours,
      targetTime: p.timestamp,
      aqi: p.aqi,
      low: p.low,
      high: p.high,
      confidence: FLAG === 'noconfidence' ? undefined : Math.round(Math.min(0.95, Math.max(0.5, 0.93 - 0.013 * hours)) * 100) / 100,
    }
  })

  const sixHourDelta = series[6].aqi - current
  const insight =
    sixHourDelta > 5
      ? 'AQI is likely to keep climbing over the next few hours.'
      : sixHourDelta < -5
        ? 'Air should slowly improve over the next few hours.'
        : 'AQI is expected to stay close to its current level.'

  return {
    locationId,
    generatedAt: new Date(anchor).toISOString(),
    modelVersion: 'mock-0.1',
    series,
    horizons,
    factors: FLAG === 'nofactors' ? [] : factorsFor(sixHourDelta),
    insight,
  }
}
