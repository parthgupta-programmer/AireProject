// Contract for the ML backend's prediction response.
//
// Built for growth: the model returns an hourly `series` and a list of `horizons`. The UI draws its horizon
// selector and chart range from those lists, so adding longer forecasts later (say 48 h or 5 days) only needs
// the backend to send more horizons and a longer series. No UI redesign.

export type FactorImpact = 'raises' | 'lowers' | 'neutral'

export interface PredictionFactor {
  id: string
  label: string
  impact: FactorImpact
  /** Relative influence, 0–1. Used for ordering and the small bar. Not a probability. */
  weight: number
  /** One short line of plain language. */
  detail?: string
}

export interface PredictionPoint {
  timestamp: string
  aqi: number
  /** Uncertainty band around the estimate, when the model supplies one. */
  low?: number
  high?: number
}

export interface PredictionHorizon {
  hours: number
  targetTime: string
  aqi: number
  low?: number
  high?: number
  /** 0–1. Optional: not every model reports it. */
  confidence?: number
}

export interface AqiPrediction {
  locationId: string
  /** When the model produced this estimate. The first `series` point is anchored here. */
  generatedAt: string
  modelVersion?: string
  series: PredictionPoint[]
  horizons: PredictionHorizon[]
  factors: PredictionFactor[]
  /** Short model-written summary. */
  insight?: string
}
