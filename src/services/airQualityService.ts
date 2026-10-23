/**
 * Air Quality Service
 *
 * Primary service providing live atmospheric measurements, national city AQI,
 * historical trend series, and location indexing for the Aire application.
 *
 * Operational Modes:
 * - Production / Default: Directly queries Open-Meteo Air Quality API with live
 *   atmospheric variables, mapped through India CPCB NAQI formula (cpcbAqi.ts).
 *   On network/API errors, throws AirQualityServiceError to trigger legitimate UI error/stale states.
 *   No silent mock data substitution is permitted.
 * - Explicit Mock / Test Mode: Activated only when '?mock=...' is present in the query string
 *   or when VITE_USE_MOCK_AQI='true' is set in .env.
 */

import {
  INDIA_LOCATIONS,
  type IndiaLocation,
} from '@/data/indiaLocations'

import {
  fetchCurrentAirQuality,
  fetchNationalAirQuality,
  fetchAqiHistory,
} from './openMeteoService'

import {
  FLAG,
  hashString,
  rand01,
  simulateNetwork,
} from './mock'

import type {
  AirQualityData,
  AqiHistory,
  CityAqi,
  HistoryRange,
  LocationOption,
  PollutantReadings,
} from '@/types/airQuality'

type MockLocation = IndiaLocation
const MONITORED_LOCATIONS: MockLocation[] = INDIA_LOCATIONS

export class AirQualityServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AirQualityServiceError'
  }
}

const stripMock = ({
  baseAqi: _baseAqi,
  ...loc
}: MockLocation): LocationOption => loc

/**
 * Check whether explicit mock mode is requested via URL flag or environment variable.
 */
const IS_EXPLICIT_MOCK =
  Boolean(FLAG) || (import.meta.env.VITE_USE_MOCK_AQI as string | undefined)?.toLowerCase() === 'true'

/**
 * Synchronous so the app can start with a sensible location before anything loads.
 */
export const getDefaultLocation = (): LocationOption =>
  stripMock(
    MONITORED_LOCATIONS.find((l) => l.id === 'ghaziabad') ?? MONITORED_LOCATIONS[0],
  )

/**
 * True if the id belongs to a place we monitor (guards against stale values in localStorage).
 */
export const isKnownLocation = (id: string): boolean =>
  MONITORED_LOCATIONS.some((l) => l.id === id)

const findLocation = (id: string): MockLocation | undefined =>
  MONITORED_LOCATIONS.find((l) => l.id === id)

// ── Mock Generator Helpers (Reserved for Explicit Dev/Test Mode) ─────────────

const MEASURE_EVERY_MS = FLAG === 'fast' ? 15_000 : 5 * 60_000
const HOUR = 3_600_000
const DAY = 24 * HOUR

const noiseAt = (seed: number, k: number) =>
  rand01((seed + Math.imul(k | 0, 7919)) >>> 0) * 2 - 1

function smoothNoise(seed: number, x: number) {
  const a = Math.floor(x)
  const f = x - a
  const s = f * f * (3 - 2 * f)
  return noiseAt(seed, a) * (1 - s) + noiseAt(seed, a + 1) * s
}

function interp(table: [number, number][], x: number) {
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]
    if (x <= x1) {
      const [x0, y0] = table[i - 1]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  const [xa, ya] = table[table.length - 2]
  const [xb, yb] = table[table.length - 1]
  return yb + ((yb - ya) * (x - xb)) / (xb - xa)
}

const PM25_BY_AQI: [number, number][] = [
  [0, 0],
  [50, 30],
  [100, 60],
  [200, 90],
  [300, 120],
  [400, 250],
  [500, 380],
]

function mockAqiAt(loc: MockLocation, t: number) {
  const seed = hashString(loc.id)
  const d = new Date(t)
  const hour = d.getHours() + d.getMinutes() / 60
  const rhythm = 0.14 * Math.cos(((hour - 9) / 12) * 2 * Math.PI)
  const slow = 0.25 * smoothNoise(seed + 101, t / DAY)
  const medium = 0.1 * smoothNoise(seed, t / HOUR)
  const jitter =
    (rand01((seed ^ Math.floor(t / MEASURE_EVERY_MS)) >>> 0) * 2 - 1) *
    (FLAG === 'fast' ? 8 : 2.5)

  return Math.round(
    Math.min(
      480,
      Math.max(8, loc.baseAqi * (1 + rhythm + slow + medium) + jitter),
    ),
  )
}

function mockPollutantsAt(loc: MockLocation, aqi: number, t: number): PollutantReadings {
  const seed = hashString(loc.id) ^ Math.floor(t / MEASURE_EVERY_MS)
  const n = (i: number) => rand01((seed + i * 977) >>> 0) * 2 - 1
  const hour = new Date(t).getHours()
  const afternoon = Math.max(0, Math.cos(((hour - 15) / 24) * 2 * Math.PI))
  const pm25 = interp(PM25_BY_AQI, aqi) * (1 + 0.06 * n(1))

  const all: PollutantReadings = {
    pm25: Math.round(pm25),
    pm10: Math.round(pm25 * (1.4 + 0.2 * n(2))),
    no2: Math.round(18 + aqi * 0.16 * (1 + 0.15 * n(3))),
    so2: Math.round(6 + aqi * 0.05 * (1 + 0.2 * n(4))),
    co: Math.round((0.35 + aqi * 0.0055 * (1 + 0.15 * n(5))) * 10) / 10,
    o3: Math.round(24 + aqi * 0.13 * (1 + 0.2 * n(6)) + 12 * afternoon),
  }

  if (FLAG === 'nopollutants') return {}
  if (FLAG === 'partial') {
    delete all.so2
    delete all.co
  }
  return all
}

function mockLatestMeasurementTime() {
  const now = Date.now()
  return FLAG === 'stale'
    ? now - 14 * 60_000
    : Math.floor(now / MEASURE_EVERY_MS) * MEASURE_EVERY_MS
}

// ── Public Service API ───────────────────────────────────────────────────────

export async function searchLocations(query = ''): Promise<LocationOption[]> {
  const q = query.trim().toLowerCase()
  return MONITORED_LOCATIONS
    .filter(
      (l) =>
        !q ||
        [l.name, l.region, l.regionType].some((part) =>
          part?.toLowerCase().includes(q),
        ),
    )
    .sort(
      (a, b) =>
        (a.region ?? '').localeCompare(b.region ?? '') ||
        a.name.localeCompare(b.name),
    )
    .map(stripMock)
}

/**
 * Current AQI for every monitored city:
 * Feeds the India map and the most / least polluted rankings.
 */
export async function getNationalAirQuality(): Promise<CityAqi[]> {
  if (IS_EXPLICIT_MOCK) {
    await simulateNetwork()
    const t = mockLatestMeasurementTime()
    return MONITORED_LOCATIONS.map((loc) => ({
      location: stripMock(loc),
      aqi: mockAqiAt(loc, t),
    }))
  }

  try {
    const locations = MONITORED_LOCATIONS.map(stripMock)
    return await fetchNationalAirQuality(locations)
  } catch (err) {
    throw new AirQualityServiceError('Failed to fetch national air quality data', err)
  }
}

/**
 * Current air quality reading for a single location.
 */
export async function getCurrentAirQuality(locationId: string): Promise<AirQualityData> {
  const loc = findLocation(locationId)
  if (!loc) {
    throw new AirQualityServiceError(`Unknown location id: "${locationId}"`)
  }

  if (IS_EXPLICIT_MOCK) {
    await simulateNetwork()
    const t = mockLatestMeasurementTime()
    const aqi = mockAqiAt(loc, t)
    return {
      location: stripMock(loc),
      aqi,
      timestamp: new Date(t).toISOString(),
      pollutants: mockPollutantsAt(loc, aqi, t),
      previousAqi: mockAqiAt(loc, t - MEASURE_EVERY_MS),
    }
  }

  try {
    return await fetchCurrentAirQuality(stripMock(loc))
  } catch (err) {
    throw new AirQualityServiceError(
      `Failed to fetch air quality for ${loc.name}: ${err instanceof Error ? err.message : String(err)}`,
      err,
    )
  }
}

const MOCK_HISTORY_SHAPE: Record<HistoryRange, { stepMs: number; count: number }> = {
  '24h': { stepMs: 30 * 60_000, count: 48 },
  '3d': { stepMs: 2 * HOUR, count: 36 },
  '7d': { stepMs: 6 * HOUR, count: 28 },
}

/**
 * Historical hourly observed AQI data for trend visualization.
 */
export async function getAqiHistory(
  locationId: string,
  range: HistoryRange,
): Promise<AqiHistory> {
  const loc = findLocation(locationId)
  if (!loc) {
    throw new AirQualityServiceError(`Unknown location id: "${locationId}"`)
  }

  if (IS_EXPLICIT_MOCK) {
    await simulateNetwork()
    if (FLAG === 'nohistory') {
      return { locationId, range, points: [] }
    }
    const end = mockLatestMeasurementTime()
    const { stepMs, count } = MOCK_HISTORY_SHAPE[range]
    const points = Array.from({ length: count + 1 }, (_, i) => {
      const t = end - (count - i) * stepMs
      return {
        timestamp: new Date(t).toISOString(),
        aqi: mockAqiAt(loc, t),
      }
    })
    return { locationId, range, points }
  }

  try {
    return await fetchAqiHistory(stripMock(loc), range)
  } catch (err) {
    throw new AirQualityServiceError(
      `Failed to fetch history for ${loc.name} (${range}): ${err instanceof Error ? err.message : String(err)}`,
      err,
    )
  }
}

/**
 * Backward compatibility helper for predictionService mock fallback.
 */
export const mockDataForPrediction = {
  aqiAt: (locationId: string, t: number) => {
    const loc = findLocation(locationId)
    return loc ? mockAqiAt(loc, t) : undefined
  },
  latestMeasurementTime: mockLatestMeasurementTime,
}