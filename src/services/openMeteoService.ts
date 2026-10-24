/**
 * Open-Meteo Air Quality Integration Service
 *
 * Real atmospheric measurements provider for the Aire platform:
 * - Data source: Open-Meteo Air Quality API (https://air-quality-api.open-meteo.com/v1/air-quality)
 * - Ground-level and atmospheric model variables: PM2.5, PM10, NO2, SO2, CO, O3
 * - Documented Source Units:
 *     pm2_5: ug/m3
 *     pm10: ug/m3
 *     nitrogen_dioxide: ug/m3
 *     sulphur_dioxide: ug/m3
 *     carbon_monoxide: ug/m3  (converted to mg/m3 by dividing by 1000 for CPCB NAQI)
 *     ozone: ug/m3
 *     time: ISO 8601 (UTC)
 * - Calculation: Mapped through CPCB NAQI sub-index formula (src/lib/cpcbAqi.ts)
 */

import { calculateCpcbAqi } from '@/lib/cpcbAqi'
import type {
  AirQualityData,
  AqiHistory,
  AqiHistoryPoint,
  CityAqi,
  HistoryRange,
  LocationOption,
  PollutantReadings,
} from '@/types/airQuality'

const OPENMETEO_AQ_ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const REQUEST_TIMEOUT_MS = 10_000
const CURRENT_CACHE_TTL_MS = 2 * 60_000 // 2 minutes
const NATIONAL_CACHE_TTL_MS = 2 * 60_000 // 2 minutes
const HISTORY_CACHE_TTL_MS = 3 * 60_000 // 3 minutes

// ── In-Memory Cache Structures ───────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const currentCache = new Map<string, CacheEntry<AirQualityData>>()
let nationalCache: CacheEntry<CityAqi[]> | null = null
const historyCache = new Map<string, CacheEntry<AqiHistory>>()

export function clearOpenMeteoCache(): void {
  currentCache.clear()
  nationalCache = null
  historyCache.clear()
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  return fetch(url, { signal: controller.signal })
    .then((res) => {
      clearTimeout(timeoutId)
      return res
    })
    .catch((err: Error) => {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        throw new Error(`Open-Meteo request timed out after ${timeoutMs}ms`)
      }
      throw err
    })
}

function parseIsoTimestamp(t: string): string {
  // Open-Meteo returns timestamps like "2026-10-23T15:00"
  if (!t.endsWith('Z') && !t.includes('+') && !t.includes('-', 10)) {
    return new Date(`${t}Z`).toISOString()
  }
  return new Date(t).toISOString()
}

interface OpenMeteoCurrentResponse {
  latitude: number
  longitude: number
  current?: {
    time: string
    pm2_5?: number | null
    pm10?: number | null
    nitrogen_dioxide?: number | null
    sulphur_dioxide?: number | null
    ozone?: number | null
    carbon_monoxide?: number | null
  }
  hourly?: {
    time: string[]
    pm2_5?: (number | null)[]
    pm10?: (number | null)[]
    nitrogen_dioxide?: (number | null)[]
    sulphur_dioxide?: (number | null)[]
    ozone?: (number | null)[]
    carbon_monoxide?: (number | null)[]
  }
}

function extractPollutants(src: {
  pm2_5?: number | null
  pm10?: number | null
  nitrogen_dioxide?: number | null
  sulphur_dioxide?: number | null
  ozone?: number | null
  carbon_monoxide?: number | null
}): PollutantReadings {
  const p: PollutantReadings = {}
  if (src.pm2_5 !== undefined && src.pm2_5 !== null && src.pm2_5 >= 0) {
    p.pm25 = Math.round(src.pm2_5)
  }
  if (src.pm10 !== undefined && src.pm10 !== null && src.pm10 >= 0) {
    p.pm10 = Math.round(src.pm10)
  }
  if (src.nitrogen_dioxide !== undefined && src.nitrogen_dioxide !== null && src.nitrogen_dioxide >= 0) {
    p.no2 = Math.round(src.nitrogen_dioxide)
  }
  if (src.sulphur_dioxide !== undefined && src.sulphur_dioxide !== null && src.sulphur_dioxide >= 0) {
    p.so2 = Math.round(src.sulphur_dioxide)
  }
  if (src.carbon_monoxide !== undefined && src.carbon_monoxide !== null && src.carbon_monoxide >= 0) {
    // Open-Meteo CO is in ug/m3. Convert to mg/m3 for India CPCB NAQI standard.
    p.co = Math.round((src.carbon_monoxide / 1000) * 10) / 10
  }
  if (src.ozone !== undefined && src.ozone !== null && src.ozone >= 0) {
    p.o3 = Math.round(src.ozone)
  }
  return p
}

// ── Public API Methods ───────────────────────────────────────────────────────

/**
 * Fetch current air quality and previous hour comparison for a specific location.
 */
export async function fetchCurrentAirQuality(
  location: LocationOption,
  bypassCache = false,
): Promise<AirQualityData> {
  const cacheKey = location.id
  const now = Date.now()

  if (!bypassCache) {
    const cached = currentCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.data
    }
  }

  const params = new URLSearchParams({
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
    current: 'pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide',
    hourly: 'pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide',
    past_hours: '3',
    forecast_hours: '1',
    timezone: 'UTC',
  })

  const url = `${OPENMETEO_AQ_ENDPOINT}?${params.toString()}`
  const resp = await fetchWithTimeout(url)

  if (!resp.ok) {
    throw new Error(`Open-Meteo Air Quality API returned HTTP ${resp.status} (${resp.statusText})`)
  }

  const raw = (await resp.json()) as OpenMeteoCurrentResponse
  if (!raw.current) {
    throw new Error(`Open-Meteo response for ${location.name} did not contain current readings`)
  }

  const pollutants = extractPollutants(raw.current)
  const aqiResult = calculateCpcbAqi(pollutants)

  if (aqiResult.aqi === null) {
    throw new Error(`Insufficient pollutant data to calculate AQI for ${location.name}`)
  }

  // Calculate previous hour's AQI from hourly history
  let previousAqi: number | undefined
  if (raw.hourly && raw.hourly.time && raw.hourly.time.length >= 2) {
    const times = raw.hourly.time
    const currentIso = parseIsoTimestamp(raw.current.time)

    // Look for reading immediately preceding current measurement
    let prevIndex = -1
    for (let i = times.length - 1; i >= 0; i--) {
      const tIso = parseIsoTimestamp(times[i])
      if (tIso < currentIso) {
        prevIndex = i
        break
      }
    }

    if (prevIndex >= 0) {
      const prevPollutants = extractPollutants({
        pm2_5: raw.hourly.pm2_5?.[prevIndex],
        pm10: raw.hourly.pm10?.[prevIndex],
        nitrogen_dioxide: raw.hourly.nitrogen_dioxide?.[prevIndex],
        sulphur_dioxide: raw.hourly.sulphur_dioxide?.[prevIndex],
        ozone: raw.hourly.ozone?.[prevIndex],
        carbon_monoxide: raw.hourly.carbon_monoxide?.[prevIndex],
      })
      const prevResult = calculateCpcbAqi(prevPollutants)
      if (prevResult.aqi !== null) {
        previousAqi = prevResult.aqi
      }
    }
  }

  const data: AirQualityData = {
    location,
    aqi: aqiResult.aqi,
    timestamp: parseIsoTimestamp(raw.current.time),
    fetchedAt: new Date(now).toISOString(),
    pollutants,
    previousAqi,
  }

  currentCache.set(cacheKey, { data, expiresAt: now + CURRENT_CACHE_TTL_MS })
  return data
}

/**
 * Fetch current AQI across all monitored Indian cities using multi-location batching.
 */
export async function fetchNationalAirQuality(
  locations: LocationOption[],
  bypassCache = false,
): Promise<CityAqi[]> {
  const now = Date.now()

  if (!bypassCache && nationalCache && nationalCache.expiresAt > now) {
    return nationalCache.data
  }

  if (locations.length === 0) return []

  // Batch locations into chunks of 30 to respect URL length and API constraints
  const CHUNK_SIZE = 30
  const chunks: LocationOption[][] = []
  for (let i = 0; i < locations.length; i += CHUNK_SIZE) {
    chunks.push(locations.slice(i, i + CHUNK_SIZE))
  }

  const fetchChunk = async (chunk: LocationOption[]): Promise<CityAqi[]> => {
    const lats = chunk.map((l) => l.latitude).join(',')
    const lons = chunk.map((l) => l.longitude).join(',')

    const params = new URLSearchParams({
      latitude: lats,
      longitude: lons,
      current: 'pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide',
      timezone: 'UTC',
    })

    const url = `${OPENMETEO_AQ_ENDPOINT}?${params.toString()}`
    const resp = await fetchWithTimeout(url)

    if (!resp.ok) {
      throw new Error(`Open-Meteo batch request failed with status ${resp.status}`)
    }

    const json = await resp.json()
    // Open-Meteo returns a single object if only 1 location was passed, or an array for multiple
    const results: OpenMeteoCurrentResponse[] = Array.isArray(json) ? json : [json]

    return results.map((item, idx) => {
      const loc = chunk[idx]
      if (!item.current) {
        return { location: loc, aqi: 0 }
      }
      const p = extractPollutants(item.current)
      const res = calculateCpcbAqi(p)
      return {
        location: loc,
        aqi: res.aqi ?? 0,
      }
    })
  }

  const chunkResults = await Promise.all(chunks.map((c) => fetchChunk(c)))
  const combined = chunkResults.flat()

  nationalCache = { data: combined, expiresAt: now + NATIONAL_CACHE_TTL_MS }
  return combined
}

/**
 * Fetch historical observed hourly AQI data for a given range (24h, 3d, 7d).
 */
export async function fetchAqiHistory(
  location: LocationOption,
  range: HistoryRange,
  bypassCache = false,
): Promise<AqiHistory> {
  const cacheKey = `${location.id}:${range}`
  const now = Date.now()

  if (!bypassCache) {
    const cached = historyCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.data
    }
  }

  const pastDaysMap: Record<HistoryRange, number> = {
    '24h': 1,
    '3d': 3,
    '7d': 7,
  }

  const pastDays = pastDaysMap[range] ?? 1

  const params = new URLSearchParams({
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
    hourly: 'pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide',
    past_days: pastDays.toString(),
    forecast_days: '1',
    timezone: 'UTC',
  })

  const url = `${OPENMETEO_AQ_ENDPOINT}?${params.toString()}`
  const resp = await fetchWithTimeout(url)

  if (!resp.ok) {
    throw new Error(`Open-Meteo history query failed with status ${resp.status}`)
  }

  const raw = (await resp.json()) as OpenMeteoCurrentResponse
  if (!raw.hourly || !raw.hourly.time) {
    throw new Error(`No hourly data available for location ${location.name}`)
  }

  const points: AqiHistoryPoint[] = []
  const times = raw.hourly.time
  const currentTimeIso = new Date().toISOString()

  // Calculate target start timestamp based on range
  const rangeMsMap: Record<HistoryRange, number> = {
    '24h': 24 * 3_600_000,
    '3d': 72 * 3_600_000,
    '7d': 168 * 3_600_000,
  }
  const minTimestampMs = now - (rangeMsMap[range] ?? 24 * 3_600_000)

  for (let i = 0; i < times.length; i++) {
    const tIso = parseIsoTimestamp(times[i])
    const tMs = new Date(tIso).getTime()

    // Only include past observed points within requested range window
    if (tIso > currentTimeIso || tMs < minTimestampMs) {
      continue
    }

    const p = extractPollutants({
      pm2_5: raw.hourly.pm2_5?.[i],
      pm10: raw.hourly.pm10?.[i],
      nitrogen_dioxide: raw.hourly.nitrogen_dioxide?.[i],
      sulphur_dioxide: raw.hourly.sulphur_dioxide?.[i],
      ozone: raw.hourly.ozone?.[i],
      carbon_monoxide: raw.hourly.carbon_monoxide?.[i],
    })

    const calc = calculateCpcbAqi(p)
    if (calc.aqi !== null) {
      points.push({
        timestamp: tIso,
        aqi: calc.aqi,
      })
    }
  }

  // Sort chronologically ascending
  points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const historyResult: AqiHistory = {
    locationId: location.id,
    range,
    points,
  }

  historyCache.set(cacheKey, { data: historyResult, expiresAt: now + HISTORY_CACHE_TTL_MS })
  return historyResult
}
