import type { PredictionHorizon } from '@/types/prediction'

/** "6 hours", "24 hours", "5 days" */
export const formatHorizon = (hours: number) =>
  hours < 48 ? `${hours} hour${hours === 1 ? '' : 's'}` : `${Math.round(hours / 24)} days`

/** "6H", "24H", "5D" */
export const horizonShortLabel = (hours: number) => (hours < 48 ? `${hours}H` : `${Math.round(hours / 24)}D`)

export function pickHorizon(horizons: PredictionHorizon[], preferred: number | null, fallback: number) {
  return (
    horizons.find((h) => h.hours === preferred) ??
    horizons.find((h) => h.hours === fallback) ??
    horizons[0]
  )
}

export function getConfidenceLevel(confidence: number) {
  return confidence >= 0.8 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low'
}

/** Wording that never states the number as a certainty. */
export function getPredictionPhrase(current: number, predicted: number) {
  const delta = predicted - current
  if (Math.abs(delta) <= 5) return 'AQI may stay around'
  return delta > 0 ? 'AQI may reach' : 'AQI may fall to'
}
