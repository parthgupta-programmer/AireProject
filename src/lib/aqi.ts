// Single source of truth for AQI categories. Adjust ranges here if your data provider uses a different scale.
export type AqiKey = 'good' | 'moderate' | 'poor' | 'veryPoor' | 'severe'

export interface AqiCategory {
  key: AqiKey
  label: string
  min: number
  max: number
}

export const AQI_CATEGORIES: AqiCategory[] = [
  { key: 'good', label: 'Good', min: 0, max: 50 },
  { key: 'moderate', label: 'Moderate', min: 51, max: 100 },
  { key: 'poor', label: 'Poor', min: 101, max: 200 },
  { key: 'veryPoor', label: 'Very Poor', min: 201, max: 300 },
  { key: 'severe', label: 'Severe', min: 301, max: Infinity },
]

export const getAqiCategory = (aqi: number): AqiCategory =>
  AQI_CATEGORIES.find((c) => aqi <= c.max) ?? AQI_CATEGORIES[AQI_CATEGORIES.length - 1]

// Full class names so Tailwind can detect them
export const AQI_BG: Record<AqiKey, string> = {
  good: 'bg-aqi-good',
  moderate: 'bg-aqi-moderate',
  poor: 'bg-aqi-poor',
  veryPoor: 'bg-aqi-very-poor',
  severe: 'bg-aqi-severe',
}

// ---- Phase 2 additions -------------------------------------------------------

export const AQI_STROKE: Record<AqiKey, string> = {
  good: 'stroke-aqi-good',
  moderate: 'stroke-aqi-moderate',
  poor: 'stroke-aqi-poor',
  veryPoor: 'stroke-aqi-very-poor',
  severe: 'stroke-aqi-severe',
}

export const AQI_FILL: Record<AqiKey, string> = {
  good: 'fill-aqi-good',
  moderate: 'fill-aqi-moderate',
  poor: 'fill-aqi-poor',
  veryPoor: 'fill-aqi-very-poor',
  severe: 'fill-aqi-severe',
}

// One short, generic line per category. Personalised guidance arrives in the Health phase.
export const AQI_ADVICE: Record<AqiKey, string> = {
  good: 'Air is clean. Enjoy time outdoors.',
  moderate: 'Fine for most. Sensitive people should take care.',
  poor: 'Limit prolonged outdoor activity.',
  veryPoor: 'Avoid outdoor exertion. Keep windows closed.',
  severe: 'Stay indoors if you can.',
}

export type AqiTrendDirection = 'rising' | 'falling' | 'steady'

export interface AqiTrend {
  direction: AqiTrendDirection
  delta: number
}

// Changes of ±2 or less are treated as steady so the label doesn't flicker on noise.
export function getAqiTrend(aqi: number, previous?: number): AqiTrend | null {
  if (previous === undefined) return null
  const delta = aqi - previous
  const direction = Math.abs(delta) <= 2 ? 'steady' : delta > 0 ? 'rising' : 'falling'
  return { direction, delta }
}
