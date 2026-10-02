// Data contracts between the service layer and the UI.
// When the real API arrives, map its response into these shapes inside the service; the UI won't change.

export type PollutantKey = 'pm25' | 'pm10' | 'no2' | 'so2' | 'co' | 'o3'

// Partial on purpose: providers often omit a pollutant for a station.
export type PollutantReadings = Partial<Record<PollutantKey, number>>

export interface LocationOption {
  id: string
  name: string
  region?: string
  /** Whether `region` is a state or a union territory. */
  regionType?: 'State' | 'Union Territory'
  country: string
  latitude: number
  longitude: number
}

export interface AirQualityData {
  location: LocationOption
  aqi: number
  /** ISO 8601 time of the measurement (not the time it was fetched). */
  timestamp: string
  pollutants: PollutantReadings
  /** AQI of the reading before this one, used for the "improving / worsening" hint. */
  previousAqi?: number
}

/** One city's current AQI, used by the India map and rankings. */
export interface CityAqi {
  location: LocationOption
  aqi: number
}

export type HistoryRange = '24h' | '3d' | '7d'

export interface AqiHistoryPoint {
  timestamp: string
  aqi: number
}

/** Observed AQI only. Predictions get their own type in the AI Insights phase. */
export interface AqiHistory {
  locationId: string
  range: HistoryRange
  points: AqiHistoryPoint[]
}
