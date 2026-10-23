/**
 * routingService.ts
 * ─────────────────
 * Pollution-aware route planning service for AireProject.
 *
 * Routing provider  : OSRM public demo server (router.project-osrm.org)
 *                     No API key required. Free for non-commercial/low-traffic use.
 *                     Supports: driving, cycling, walking
 *                     Returns: route geometry (encoded polyline), distance (metres),
 *                              duration (seconds), up to 3 alternatives.
 *
 * Geocoding provider: Nominatim (nominatim.openstreetmap.org)
 *                     No API key required. 1 req/s limit enforced.
 *
 * Pollution data     : Open-Meteo Air Quality API (same provider as Phase 1).
 *                      AQI calculated via CPCB NAQI formula (src/lib/cpcbAqi.ts).
 *                      Sampled at every ~3 km of route geometry.
 *                      City-level granularity – labelled as a coarse estimate.
 *
 * Exposure indicator : Σ (segment_aqi × segment_duration_minutes) over all sampled
 *                      points. This is a relative decision-support index, not a
 *                      medically validated dose or pollutant-concentration measurement.
 */

import { calculateCpcbAqi } from '@/lib/cpcbAqi'
import type { LocationOption } from '@/types/airQuality'

// ── Constants ────────────────────────────────────────────────────────────────

const OSRM_BASE = 'https://router.project-osrm.org/route/v1'
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const OPEN_METEO_AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality'

const REQUEST_TIMEOUT_MS = 15_000
/** Minimum distance between AQI sample points along a route (metres). */
const SAMPLE_INTERVAL_M = 3_000

export type TravelMode = 'driving' | 'cycling' | 'walking'

// ── Types ────────────────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number
  lng: number
}

/**
 * A single point sampled along a route with its pollution observation.
 */
export interface RouteSamplePoint {
  lat: number
  lng: number
  /** CPCB NAQI AQI value, or null when insufficient pollutant data. */
  aqi: number | null
  /** ISO 8601 timestamp of the Open-Meteo observation. */
  observedAt: string | null
  /** Whether this is observed or missing data. */
  dataAvailable: boolean
}

export interface RouteExposureResult {
  /**
   * Relative exposure index = Σ (aqi_i × duration_fraction_i × minutes_total).
   * null if no sample points had valid AQI data.
   */
  exposureIndex: number | null
  /** Fraction of sample points that returned valid AQI readings (0–1). */
  coverageFraction: number
  /** Count of sample points with data. */
  coveredPoints: number
  /** Total sample points attempted. */
  totalPoints: number
  /** Arithmetic mean AQI across covered points, or null if none. */
  meanAqi: number | null
  /** ISO 8601 of the oldest observation used. */
  oldestObservation: string | null
}

export interface ParsedRoute {
  /** OSRM route index (0 = primary). */
  index: number
  /** Distance in metres. */
  distanceM: number
  /** Travel time in seconds. */
  durationS: number
  /** Decoded polyline as [lat, lng] pairs. */
  geometry: [number, number][]
  /** Sampled points with pollution data. */
  samplePoints: RouteSamplePoint[]
  /** Exposure calculation results. */
  exposure: RouteExposureResult
  /** Human-readable label. */
  label: string
}

// ── Polyline Decoder ─────────────────────────────────────────────────────────

/**
 * Decode a Google/OSRM-encoded polyline string into [lat, lng] pairs.
 * Precision: 1e-5 (OSRM default).
 */
export function decodePolyline(encoded: string, precision = 1e5): [number, number][] {
  const points: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let b: number
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    points.push([lat / precision, lng / precision])
  }

  return points
}

// ── Distance Helpers ─────────────────────────────────────────────────────────

/** Haversine distance between two lat/lng points in metres. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Sample points at a given interval from a polyline.
 * Returns representative [lat, lng] pairs and their cumulative-distance fractions.
 */
export function sampleGeometry(
  geometry: [number, number][],
  intervalM: number,
): [number, number][] {
  if (geometry.length === 0) return []
  if (geometry.length === 1) return [[geometry[0][0], geometry[0][1]]]

  const samples: [number, number][] = [geometry[0]]
  let accumulated = 0
  let nextSample = intervalM

  for (let i = 1; i < geometry.length; i++) {
    const d = haversineM(
      geometry[i - 1][0],
      geometry[i - 1][1],
      geometry[i][0],
      geometry[i][1],
    )
    accumulated += d

    if (accumulated >= nextSample) {
      samples.push(geometry[i])
      nextSample += intervalM
    }
  }

  // Always include the endpoint
  const last = geometry[geometry.length - 1]
  const alreadyAdded = samples[samples.length - 1]
  if (alreadyAdded[0] !== last[0] || alreadyAdded[1] !== last[1]) {
    samples.push(last)
  }

  return samples
}

// ── Fetch Helper ─────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, ms = REQUEST_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const resp = await fetch(url, { signal: ctrl.signal })
    return resp
  } finally {
    clearTimeout(t)
  }
}

// ── Geocoding ────────────────────────────────────────────────────────────────

export interface GeocodingResult {
  name: string
  lat: number
  lng: number
  displayName: string
}

/**
 * Geocode a free-text query using Nominatim, restricted to India.
 * Returns up to 5 results sorted by Nominatim's relevance score.
 */
export async function geocodeQuery(query: string): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    countrycodes: 'in',
    addressdetails: '0',
    limit: '5',
  })

  const url = `${NOMINATIM_BASE}?${params.toString()}`
  const resp = await fetchWithTimeout(url, 8_000)

  if (!resp.ok) {
    throw new RoutingServiceError(`Nominatim geocoding failed with HTTP ${resp.status}`)
  }

  const data = (await resp.json()) as Array<{
    display_name: string
    lat: string
    lon: string
    name?: string
    type?: string
  }>

  return data.map((item) => ({
    name: item.display_name.split(',')[0].trim(),
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name,
  }))
}

/**
 * Convert a LocationOption from the existing location database to a GeoPoint.
 */
export function locationToGeoPoint(loc: LocationOption): GeoPoint {
  return { lat: loc.latitude, lng: loc.longitude }
}

// ── AQI Sampling ─────────────────────────────────────────────────────────────

interface OpenMeteoAQBatch {
  latitude: number | number[]
  longitude: number | number[]
  current?: {
    time: string
    pm2_5?: number | null
    pm10?: number | null
    nitrogen_dioxide?: number | null
    sulphur_dioxide?: number | null
    ozone?: number | null
    carbon_monoxide?: number | null
  }
}

/**
 * Fetch AQI for up to 30 lat/lng sample points in one batched Open-Meteo request.
 * Returns one entry per point; entry may have aqi=null if data is insufficient.
 */
async function fetchAqiBatch(
  points: [number, number][],
): Promise<RouteSamplePoint[]> {
  if (points.length === 0) return []

  const lats = points.map((p) => p[0].toFixed(4)).join(',')
  const lngs = points.map((p) => p[1].toFixed(4)).join(',')

  const params = new URLSearchParams({
    latitude: lats,
    longitude: lngs,
    current: 'pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide',
    timezone: 'UTC',
  })

  const url = `${OPEN_METEO_AQ}?${params.toString()}`

  let rawData: OpenMeteoAQBatch | OpenMeteoAQBatch[]
  try {
    const resp = await fetchWithTimeout(url, 10_000)
    if (!resp.ok) {
      // Return no-data entries for all points on API error
      return points.map(([lat, lng]) => ({
        lat,
        lng,
        aqi: null,
        observedAt: null,
        dataAvailable: false,
      }))
    }
    rawData = (await resp.json()) as OpenMeteoAQBatch | OpenMeteoAQBatch[]
  } catch {
    return points.map(([lat, lng]) => ({
      lat,
      lng,
      aqi: null,
      observedAt: null,
      dataAvailable: false,
    }))
  }

  const items: OpenMeteoAQBatch[] = Array.isArray(rawData) ? rawData : [rawData]

  return points.map(([lat, lng], i) => {
    const item = items[i]
    if (!item?.current) {
      return { lat, lng, aqi: null, observedAt: null, dataAvailable: false }
    }

    const cur = item.current
    const pollutants = {
      ...(cur.pm2_5 !== null && cur.pm2_5 !== undefined && cur.pm2_5 >= 0 ? { pm25: Math.round(cur.pm2_5) } : {}),
      ...(cur.pm10 !== null && cur.pm10 !== undefined && cur.pm10 >= 0 ? { pm10: Math.round(cur.pm10) } : {}),
      ...(cur.nitrogen_dioxide !== null && cur.nitrogen_dioxide !== undefined && cur.nitrogen_dioxide >= 0 ? { no2: Math.round(cur.nitrogen_dioxide) } : {}),
      ...(cur.sulphur_dioxide !== null && cur.sulphur_dioxide !== undefined && cur.sulphur_dioxide >= 0 ? { so2: Math.round(cur.sulphur_dioxide) } : {}),
      ...(cur.ozone !== null && cur.ozone !== undefined && cur.ozone >= 0 ? { o3: Math.round(cur.ozone) } : {}),
      ...(cur.carbon_monoxide !== null && cur.carbon_monoxide !== undefined && cur.carbon_monoxide >= 0
        ? { co: Math.round((cur.carbon_monoxide / 1000) * 10) / 10 }
        : {}),
    }

    const result = calculateCpcbAqi(pollutants)
    const timestamp = cur.time
      ? (() => {
          const t = cur.time
          if (!t.endsWith('Z') && !t.includes('+') && !t.includes('-', 10)) {
            return new Date(`${t}Z`).toISOString()
          }
          return new Date(t).toISOString()
        })()
      : null

    return {
      lat,
      lng,
      aqi: result.aqi,
      observedAt: timestamp,
      dataAvailable: result.aqi !== null,
    }
  })
}

/**
 * Sample AQI along a decoded route geometry.
 * Batches requests to Open-Meteo in groups of 30.
 */
export async function sampleRouteAqi(
  geometry: [number, number][],
): Promise<RouteSamplePoint[]> {
  const points = sampleGeometry(geometry, SAMPLE_INTERVAL_M)
  const BATCH = 30
  const results: RouteSamplePoint[] = []

  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH)
    const batchResults = await fetchAqiBatch(batch)
    results.push(...batchResults)
  }

  return results
}

// ── Exposure Calculator ───────────────────────────────────────────────────────

/**
 * Calculate a relative pollution-exposure index for a route.
 *
 * Method:
 *   - Divide total route duration equally across all sample intervals.
 *   - Exposure contribution of each sample point = aqi_i × duration_fraction × total_minutes.
 *   - Sum all contributions → exposureIndex.
 *
 * If fewer than 10 % of sample points have data, exposure is reported as null
 * (insufficient coverage) rather than a misleading partial estimate.
 *
 * Data gaps are NOT interpolated or treated as zero; they are excluded from the sum
 * and reduce the coverage fraction.
 */
export function calculateExposure(
  samplePoints: RouteSamplePoint[],
  durationS: number,
): RouteExposureResult {
  const totalMinutes = durationS / 60
  const n = samplePoints.length
  const covered = samplePoints.filter((p) => p.aqi !== null)
  const coverageFraction = n > 0 ? covered.length / n : 0
  const meanAqi =
    covered.length > 0
      ? Math.round(covered.reduce((s, p) => s + p.aqi!, 0) / covered.length)
      : null

  // Reject if coverage is below 10 %
  if (covered.length === 0 || coverageFraction < 0.1) {
    return {
      exposureIndex: null,
      coverageFraction,
      coveredPoints: covered.length,
      totalPoints: n,
      meanAqi,
      oldestObservation: null,
    }
  }

  // Each point represents 1/n of the total trip duration
  const durationPerPoint = totalMinutes / n
  const exposureIndex = Math.round(
    covered.reduce((s, p) => s + p.aqi! * durationPerPoint, 0),
  )

  // Oldest observation used
  const timestamps = covered
    .map((p) => p.observedAt)
    .filter(Boolean)
    .sort() as string[]
  const oldestObservation = timestamps.length > 0 ? timestamps[0] : null

  return {
    exposureIndex,
    coverageFraction,
    coveredPoints: covered.length,
    totalPoints: n,
    meanAqi,
    oldestObservation,
  }
}

// ── Error Type ───────────────────────────────────────────────────────────────

export class RoutingServiceError extends Error {
  constructor(
    message: string,
    public readonly code?: 'NO_ROUTE' | 'TIMEOUT' | 'GEOCODING' | 'PROVIDER' | 'VALIDATION',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'RoutingServiceError'
  }
}

// ── OSRM Routing ─────────────────────────────────────────────────────────────

interface OsrmRoute {
  distance: number
  duration: number
  geometry: string // encoded polyline
  legs: Array<{ distance: number; duration: number }>
}

interface OsrmResponse {
  code: string
  message?: string
  routes?: OsrmRoute[]
  waypoints?: Array<{ location: [number, number]; name: string }>
}

/**
 * Fetch routes from the OSRM demo server.
 *
 * @param origin     - Start point [lat, lng]
 * @param destination - End point [lat, lng]
 * @param mode       - Travel mode (driving | cycling | walking)
 * @returns          - Parsed routes with geometry and exposure
 *
 * Notes on OSRM alternatives:
 * - OSRM demo server returns alternatives for driving mode only.
 * - Cycling and walking modes return a single route.
 * - Maximum 3 alternatives are requested.
 */
export async function fetchRoutes(
  origin: GeoPoint,
  destination: GeoPoint,
  mode: TravelMode,
): Promise<ParsedRoute[]> {
  // Validate inputs
  if (!isValidLatLng(origin.lat, origin.lng)) {
    throw new RoutingServiceError('Invalid origin coordinates.', 'VALIDATION')
  }
  if (!isValidLatLng(destination.lat, destination.lng)) {
    throw new RoutingServiceError('Invalid destination coordinates.', 'VALIDATION')
  }

  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
  const params = new URLSearchParams({
    alternatives: 'true',   // OSRM returns up to 3 alternatives for driving
    steps: 'false',
    geometries: 'polyline', // standard Google-encoded polyline
    overview: 'full',
  })

  const url = `${OSRM_BASE}/${mode}/${coords}?${params.toString()}`

  let resp: Response
  try {
    resp = await fetchWithTimeout(url)
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError'
    throw new RoutingServiceError(
      isAbort
        ? 'Routing request timed out. Check your connection and try again.'
        : 'Could not reach the routing server. Check your connection.',
      isAbort ? 'TIMEOUT' : 'PROVIDER',
      err,
    )
  }

  if (!resp.ok) {
    throw new RoutingServiceError(
      `Routing provider returned an error (HTTP ${resp.status}). Try again later.`,
      'PROVIDER',
    )
  }

  const data = (await resp.json()) as OsrmResponse

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    const msg =
      data.message ??
      (data.code === 'NoRoute'
        ? 'No route found between the selected points for this travel mode.'
        : 'No route could be calculated.')
    throw new RoutingServiceError(msg, 'NO_ROUTE')
  }

  // Decode geometry and sample pollution for each route in parallel
  const routeLabels = ['Primary route', 'Alternative A', 'Alternative B', 'Alternative C']

  const parsed: ParsedRoute[] = await Promise.all(
    data.routes.map(async (r, i) => {
      const geometry = decodePolyline(r.geometry)
      const samplePoints = await sampleRouteAqi(geometry)
      const exposure = calculateExposure(samplePoints, r.duration)

      return {
        index: i,
        distanceM: r.distance,
        durationS: r.duration,
        geometry,
        samplePoints,
        exposure,
        label: routeLabels[i] ?? `Route ${i + 1}`,
      } satisfies ParsedRoute
    }),
  )

  return parsed
}

// ── Utility ───────────────────────────────────────────────────────────────────

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

/** Format metres to "X.X km" or "X m". */
export function formatDistance(metres: number): string {
  if (metres >= 1000) {
    return `${(metres / 1000).toFixed(1)} km`
  }
  return `${Math.round(metres)} m`
}

/** Format seconds to "Xh Ym" or "Xm". */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${mins} min`
}

/**
 * Identify the "best" route for each dimension.
 * Only labels a route as "cleanest" when exposure coverage meets the threshold.
 */
export function identifyBestRoutes(routes: ParsedRoute[]): {
  fastest: number | null
  shortest: number | null
  cleanest: number | null
} {
  if (routes.length === 0) return { fastest: null, shortest: null, cleanest: null }
  if (routes.length === 1) {
    const hasValidExposure =
      routes[0].exposure.exposureIndex !== null &&
      routes[0].exposure.coverageFraction >= 0.5
    return {
      fastest: 0,
      shortest: 0,
      cleanest: hasValidExposure ? 0 : null,
    }
  }

  const fastest = routes.reduce((b, r, i) => (r.durationS < routes[b].durationS ? i : b), 0)
  const shortest = routes.reduce((b, r, i) => (r.distanceM < routes[b].distanceM ? i : b), 0)

  // Only compare exposure for routes where coverage >= 50 %
  const eligible = routes
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.exposure.exposureIndex !== null && r.exposure.coverageFraction >= 0.5)

  const cleanest =
    eligible.length >= 2
      ? eligible.reduce((b, cur) =>
          cur.r.exposure.exposureIndex! < b.r.exposure.exposureIndex! ? cur : b,
        ).i
      : null

  return { fastest, shortest, cleanest }
}

/**
 * Builds a direct Google Maps Directions URL for navigation.
 * Uses the official Google Maps Universal URL scheme:
 * https://developers.google.com/maps/documentation/urls/get-started#directions-action
 *
 * Automatically translates travel mode ('driving', 'cycling' -> 'bicycling', 'walking')
 * and passes representative intermediate waypoints from the chosen route polyline
 * so Google Maps follows the user's selected cleaner / alternative route corridor.
 */
export function buildGoogleMapsDirectionsUrl(
  origin: GeoPoint,
  destination: GeoPoint,
  mode: TravelMode = 'driving',
  route?: ParsedRoute,
): string {
  const gMode = mode === 'cycling' ? 'bicycling' : mode === 'walking' ? 'walking' : 'driving'
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=${gMode}`

  // When a specific route with geometry is provided, extract 1-2 representative waypoints
  // along the route path (at ~35% and ~65% of the distance) so Google Maps preserves
  // this specific alternative/clean route choice instead of reverting to its own default.
  if (route?.geometry && route.geometry.length >= 8) {
    const idx1 = Math.floor(route.geometry.length * 0.35)
    const idx2 = Math.floor(route.geometry.length * 0.65)
    const p1 = route.geometry[idx1]
    const p2 = route.geometry[idx2]
    if (p1 && p2) {
      const waypoints = `${p1[0].toFixed(5)},${p1[1].toFixed(5)}|${p2[0].toFixed(5)},${p2[1].toFixed(5)}`
      url += `&waypoints=${encodeURIComponent(waypoints)}`
    }
  }

  return url
}
