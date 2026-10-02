import { AQI_CATEGORIES, type AqiCategory } from '@/lib/aqi'
import type { PollutantKey } from '@/types/airQuality'

export interface PollutantMeta {
  key: PollutantKey
  label: string
  unit: string
  decimals: number
  /** Concentrations at which the level moves up: good ≤ [0] < moderate ≤ [1] < poor ≤ [2] < very poor ≤ [3] < severe.
   *  Values follow India's CPCB breakpoints. Change them here if your provider uses another standard. */
  bounds: [number, number, number, number]
  /** One or two short sentences. Longer education lives in the Learn phase. */
  description: string
}

export const POLLUTANTS: PollutantMeta[] = [
  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', decimals: 0, bounds: [30, 60, 90, 120], description: 'Fine particles that can reach deep into the lungs.' },
  { key: 'pm10', label: 'PM10', unit: 'µg/m³', decimals: 0, bounds: [50, 100, 250, 350], description: 'Coarse dust that irritates the nose and throat.' },
  { key: 'no2', label: 'NO₂', unit: 'µg/m³', decimals: 0, bounds: [40, 80, 180, 280], description: 'A gas from vehicle exhaust that can inflame the airways.' },
  { key: 'so2', label: 'SO₂', unit: 'µg/m³', decimals: 0, bounds: [40, 80, 380, 800], description: 'A gas from burning coal and oil that can make breathing harder.' },
  { key: 'co', label: 'CO', unit: 'mg/m³', decimals: 1, bounds: [1, 2, 10, 17], description: 'A colorless gas from incomplete burning that reduces oxygen in the blood.' },
  { key: 'o3', label: 'O₃', unit: 'µg/m³', decimals: 0, bounds: [50, 100, 168, 208], description: 'Ground-level ozone forms in sunlight and can trigger coughing.' },
]

// Reuses the shared AQI category list, so pollutants and the headline AQI speak the same language.
export function getPollutantLevel(meta: PollutantMeta, value: number): AqiCategory {
  const idx = meta.bounds.findIndex((b) => value <= b)
  return AQI_CATEGORIES[idx === -1 ? AQI_CATEGORIES.length - 1 : idx]
}

/** 0–1 position for the small bar; full at the "very poor" boundary. */
export const getPollutantFraction = (meta: PollutantMeta, value: number) =>
  Math.min(Math.max(value / meta.bounds[3], 0), 1)
