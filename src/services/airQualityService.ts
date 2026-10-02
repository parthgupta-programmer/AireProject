/**
 * Air quality service (MOCK).
 *
 * Everything the UI knows about air quality comes through these three functions.
 * To connect the real API: keep the signatures, replace each body with a fetch() call,
 * and map the response to the types in `@/types/airQuality`.
 *
 * The mock behaves like a real feed: it "measures" every 5 minutes, so calling it twice within the
 * same window returns the same reading. Values follow a plausible daily rhythm (morning and evening peaks).
 *
 * Test states with a query string, e.g. http://localhost:5173/?mock=stale  (full list in ./mock.ts)
 */
import { INDIA_LOCATIONS, type IndiaLocation } from '@/data/indiaLocations'
import { FLAG, hashString, rand01, simulateNetwork, sleep } from './mock'
import type {
  AirQualityData,
  CityAqi,
  AqiHistory,
  HistoryRange,
  LocationOption,
  PollutantReadings,
} from '@/types/airQuality'

type MockLocation = IndiaLocation

const MOCK_LOCATIONS: MockLocation[] = INDIA_LOCATIONS

export class AirQualityServiceError extends Error {}

const stripMock = ({ baseAqi: _baseAqi, ...loc }: MockLocation): LocationOption => loc

/** Synchronous so the app can start with a sensible location before anything loads. */
export const getDefaultLocation = (): LocationOption => stripMock(MOCK_LOCATIONS.find((l) => l.id === 'ghaziabad') ?? MOCK_LOCATIONS[0])

/** True if the id belongs to a place we monitor (guards against stale values in localStorage). */
export const isKnownLocation = (id: string) => MOCK_LOCATIONS.some((l) => l.id === id)

// ---- mock plumbing -----------------------------------------------------------

const MEASURE_EVERY_MS = FLAG === 'fast' ? 15_000 : 5 * 60_000
const HOUR = 3_600_000
const DAY = 24 * HOUR

const noiseAt = (seed: number, k: number) => rand01((seed + Math.imul(k | 0, 7919)) >>> 0) * 2 - 1

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

const PM25_BY_AQI: [number, number][] = [[0, 0], [50, 30], [100, 60], [200, 90], [300, 120], [400, 250], [500, 380]]

function aqiAt(loc: MockLocation, t: number) {
  const seed = hashString(loc.id)
  const d = new Date(t)
  const hour = d.getHours() + d.getMinutes() / 60
  const rhythm = 0.14 * Math.cos(((hour - 9) / 12) * 2 * Math.PI) // peaks near 9:00 and 21:00
  const slow = 0.25 * smoothNoise(seed + 101, t / DAY) // day-to-day weather
  const medium = 0.1 * smoothNoise(seed, t / HOUR)
  const jitter = (rand01((seed ^ Math.floor(t / MEASURE_EVERY_MS)) >>> 0) * 2 - 1) * (FLAG === 'fast' ? 8 : 2.5)
  return Math.round(Math.min(480, Math.max(8, loc.baseAqi * (1 + rhythm + slow + medium) + jitter)))
}

function pollutantsAt(loc: MockLocation, aqi: number, t: number): PollutantReadings {
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

const findLocation = (id: string) => MOCK_LOCATIONS.find((l) => l.id === id)

/** Time of the newest measurement. In `stale` mode it is deliberately old. */
function latestMeasurementTime() {
  const now = Date.now()
  return FLAG === 'stale' ? now - 14 * 60_000 : Math.floor(now / MEASURE_EVERY_MS) * MEASURE_EVERY_MS
}

// ---- public API --------------------------------------------------------------

export async function searchLocations(query = ''): Promise<LocationOption[]> {
  await sleep(120)
  const q = query.trim().toLowerCase()
  return MOCK_LOCATIONS.filter(
    (l) => !q || [l.name, l.region, l.regionType].some((part) => part?.toLowerCase().includes(q)),
  )
    .sort((a, b) => (a.region ?? '').localeCompare(b.region ?? '') || a.name.localeCompare(b.name))
    .map(stripMock)
}

/** Current AQI for every monitored city: feeds the India map and the most / least polluted lists. */
export async function getNationalAirQuality(): Promise<CityAqi[]> {
  await simulateNetwork()
  const t = latestMeasurementTime()
  return MOCK_LOCATIONS.map((loc) => ({ location: stripMock(loc), aqi: aqiAt(loc, t) }))
}

export async function getCurrentAirQuality(locationId: string): Promise<AirQualityData> {
  await simulateNetwork()
  const loc = findLocation(locationId)
  if (!loc) throw new AirQualityServiceError('Unknown location')

  const t = latestMeasurementTime()
  const aqi = aqiAt(loc, t)
  return {
    location: stripMock(loc),
    aqi,
    timestamp: new Date(t).toISOString(),
    pollutants: pollutantsAt(loc, aqi, t),
    previousAqi: aqiAt(loc, t - MEASURE_EVERY_MS),
  }
}

const HISTORY_SHAPE: Record<HistoryRange, { stepMs: number; count: number }> = {
  '24h': { stepMs: 30 * 60_000, count: 48 },
  '3d': { stepMs: 2 * HOUR, count: 36 },
  '7d': { stepMs: 6 * HOUR, count: 28 },
}

export async function getAqiHistory(locationId: string, range: HistoryRange): Promise<AqiHistory> {
  await simulateNetwork()
  const loc = findLocation(locationId)
  if (!loc) throw new AirQualityServiceError('Unknown location')
  if (FLAG === 'nohistory') return { locationId, range, points: [] }

  const end = latestMeasurementTime()
  const { stepMs, count } = HISTORY_SHAPE[range]
  const points = Array.from({ length: count + 1 }, (_, i) => {
    const t = end - (count - i) * stepMs
    return { timestamp: new Date(t).toISOString(), aqi: aqiAt(loc, t) }
  })
  return { locationId, range, points }
}

/**
 * MOCK ONLY. Lets the mock prediction service build a forecast from the same underlying data,
 * so predictions line up with what the dashboard shows. Delete this together with the mock.
 */
export const mockDataForPrediction = {
  aqiAt: (locationId: string, t: number) => {
    const loc = findLocation(locationId)
    return loc ? aqiAt(loc, t) : undefined
  },
  latestMeasurementTime,
}
