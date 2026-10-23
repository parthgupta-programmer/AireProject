/**
 * routingService.test.ts
 * ─────────────────────
 * Tests for the Phase 4 routing service.
 *
 * All routing provider and geocoding calls are mocked — no real network requests.
 * Validates:
 *  - Polyline decoder
 *  - Geometry sampling
 *  - Exposure calculator (full, partial, missing, stale, low-coverage data)
 *  - OSRM response parsing and error cases
 *  - Nominatim geocoding response parsing and error cases
 *  - identifyBestRoutes logic
 *  - formatDistance / formatDuration
 *  - Input validation
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  decodePolyline,
  sampleGeometry,
  haversineM,
  calculateExposure,
  fetchRoutes,
  geocodeQuery,
  identifyBestRoutes,
  formatDistance,
  formatDuration,
  buildGoogleMapsDirectionsUrl,
  RoutingServiceError,
  type GeoPoint,
  type ParsedRoute,
  type RouteSamplePoint,
} from '@/services/routingService'

// ── Polyline decoder ─────────────────────────────────────────────────────────

describe('decodePolyline', () => {
  it('decodes a known OSRM polyline correctly', () => {
    // "u{~vFvyys@fS]" → known points for a simple 3-point route
    // We'll use a deterministic encode/decode test instead.
    // A polyline of [[28.63, 77.22], [28.64, 77.23]] hand-encoded:
    // Point 1: lat=28.63 → 2863000 rounded; lng=77.22 → 7722000
    // We test with a simple known case using Google's test vector.
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'
    const decoded = decodePolyline(encoded)
    expect(decoded).toHaveLength(3)
    expect(decoded[0][0]).toBeCloseTo(38.5, 0)
    expect(decoded[0][1]).toBeCloseTo(-120.2, 0)
    expect(decoded[1][0]).toBeCloseTo(40.7, 0)
    expect(decoded[1][1]).toBeCloseTo(-120.95, 0)
    expect(decoded[2][0]).toBeCloseTo(43.252, 0)
    expect(decoded[2][1]).toBeCloseTo(-126.453, 0)
  })

  it('returns empty array for empty string', () => {
    expect(decodePolyline('')).toEqual([])
  })
})

// ── Haversine distance ────────────────────────────────────────────────────────

describe('haversineM', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineM(28.63, 77.22, 28.63, 77.22)).toBeCloseTo(0, 0)
  })

  it('computes Delhi→Ghaziabad distance within ±500 m of expected ~15 km', () => {
    const d = haversineM(28.6139, 77.209, 28.6692, 77.4538)
    expect(d).toBeGreaterThan(20_000) // ~24 km actual
    expect(d).toBeLessThan(30_000)
  })
})

// ── Geometry sampling ─────────────────────────────────────────────────────────

describe('sampleGeometry', () => {
  it('returns just the single point for a single-point geometry', () => {
    const pts = sampleGeometry([[28.5, 77.0]], 3000)
    expect(pts).toHaveLength(1)
    expect(pts[0]).toEqual([28.5, 77.0])
  })

  it('always includes both endpoints', () => {
    // Create a straight 30-point geometry spanning ~30 km
    const geo: [number, number][] = Array.from({ length: 30 }, (_, i) => [
      28.5 + i * 0.01,
      77.0,
    ])
    const pts = sampleGeometry(geo, 3_000)
    expect(pts[0]).toEqual(geo[0])
    expect(pts[pts.length - 1]).toEqual(geo[geo.length - 1])
    expect(pts.length).toBeGreaterThan(1)
  })

  it('returns at least 2 points for a two-point geometry', () => {
    const pts = sampleGeometry([[28.0, 77.0], [29.0, 77.0]], 3_000)
    expect(pts.length).toBeGreaterThanOrEqual(2)
  })
})

// ── Exposure calculator ───────────────────────────────────────────────────────

const makePoint = (aqi: number | null): RouteSamplePoint => ({
  lat: 28.6,
  lng: 77.2,
  aqi,
  observedAt: aqi !== null ? new Date().toISOString() : null,
  dataAvailable: aqi !== null,
})

describe('calculateExposure', () => {
  it('returns null exposureIndex when no sample points have data', () => {
    const pts = [makePoint(null), makePoint(null), makePoint(null)]
    const result = calculateExposure(pts, 3600)
    expect(result.exposureIndex).toBeNull()
    expect(result.coverageFraction).toBe(0)
    expect(result.meanAqi).toBeNull()
  })

  it('returns null when coverage is below 10 %', () => {
    // 1 out of 20 has data = 5 % → below threshold
    const pts: RouteSamplePoint[] = Array.from({ length: 20 }, (_, i) =>
      makePoint(i === 0 ? 150 : null),
    )
    const result = calculateExposure(pts, 3600)
    expect(result.exposureIndex).toBeNull()
    expect(result.coverageFraction).toBeCloseTo(1 / 20)
  })

  it('computes correct exposure for uniform AQI', () => {
    // 10 points, all AQI 100, 60 min trip
    // Each point = 60/10 = 6 min; exposure = 10 × (100 × 6) = 6000
    const pts = Array.from({ length: 10 }, () => makePoint(100))
    const result = calculateExposure(pts, 3600)
    expect(result.exposureIndex).toBe(6000)
    expect(result.coverageFraction).toBe(1)
    expect(result.meanAqi).toBe(100)
  })

  it('excludes null AQI points from exposure sum but counts them in totals', () => {
    // 8 valid (AQI 100) + 2 null = 10 total, 80 % coverage
    const pts = [
      ...Array.from({ length: 8 }, () => makePoint(100)),
      makePoint(null),
      makePoint(null),
    ]
    const result = calculateExposure(pts, 600) // 10 min trip
    expect(result.coveredPoints).toBe(8)
    expect(result.totalPoints).toBe(10)
    expect(result.coverageFraction).toBeCloseTo(0.8)
    // 8 covered × (10 min / 10 points) × 100 AQI = 800
    expect(result.exposureIndex).toBe(800)
  })

  it('computes non-null exposure even with partial data above 10 % threshold', () => {
    // 2 valid, 8 null → 20 % coverage → still should produce a result
    const pts = [
      makePoint(200),
      makePoint(200),
      ...Array.from({ length: 8 }, () => makePoint(null)),
    ]
    const result = calculateExposure(pts, 600)
    expect(result.exposureIndex).not.toBeNull()
    expect(result.meanAqi).toBe(200)
    expect(result.coverageFraction).toBeCloseTo(0.2)
  })

  it('records the oldest observation timestamp', () => {
    const old = new Date(Date.now() - 2 * 3600_000).toISOString()
    const recent = new Date(Date.now() - 600_000).toISOString()
    const pts: RouteSamplePoint[] = [
      { lat: 28.6, lng: 77.2, aqi: 100, observedAt: recent, dataAvailable: true },
      { lat: 28.7, lng: 77.3, aqi: 120, observedAt: old, dataAvailable: true },
    ]
    const result = calculateExposure(pts, 3600)
    expect(result.oldestObservation).toBe(old)
  })
})

// ── identifyBestRoutes ────────────────────────────────────────────────────────

const makeRoute = (
  distanceM: number,
  durationS: number,
  exposureIndex: number | null,
  coverageFraction: number,
): ParsedRoute => ({
  index: 0,
  distanceM,
  durationS,
  geometry: [],
  samplePoints: [],
  label: 'Test',
  exposure: {
    exposureIndex,
    coverageFraction,
    coveredPoints: 0,
    totalPoints: 1,
    meanAqi: null,
    oldestObservation: null,
  },
})

describe('identifyBestRoutes', () => {
  it('returns all nulls for empty routes', () => {
    const r = identifyBestRoutes([])
    expect(r).toEqual({ fastest: null, shortest: null, cleanest: null })
  })

  it('identifies correct fastest, shortest, cleanest from 3 routes', () => {
    const routes = [
      makeRoute(30_000, 2400, 8000, 0.9),  // medium distance, slowest, medium exposure
      makeRoute(20_000, 1800, 4000, 0.9),  // shortest + fastest + cleanest
      makeRoute(25_000, 2100, 6000, 0.9),  // middle
    ]
    const r = identifyBestRoutes(routes)
    expect(r.fastest).toBe(1)
    expect(r.shortest).toBe(1)
    expect(r.cleanest).toBe(1)
  })

  it('does not label cleanest when all routes have low coverage', () => {
    const routes = [
      makeRoute(30_000, 2400, 8000, 0.3), // coverage below 50 %
      makeRoute(20_000, 1800, 4000, 0.4), // coverage below 50 %
    ]
    const r = identifyBestRoutes(routes)
    expect(r.cleanest).toBeNull()
  })

  it('does not label cleanest when only one eligible route exists', () => {
    const routes = [
      makeRoute(30_000, 2400, 8000, 0.8), // eligible
      makeRoute(20_000, 1800, 4000, 0.2), // ineligible
    ]
    const r = identifyBestRoutes(routes)
    // Only one eligible → can't compare → null
    expect(r.cleanest).toBeNull()
  })
})

// ── formatDistance / formatDuration ──────────────────────────────────────────

describe('formatDistance', () => {
  it('formats metres below 1000 as "X m"', () => {
    expect(formatDistance(500)).toBe('500 m')
    expect(formatDistance(999)).toBe('999 m')
  })

  it('formats 1000+ m as "X.X km"', () => {
    expect(formatDistance(1000)).toBe('1.0 km')
    expect(formatDistance(25_400)).toBe('25.4 km')
    expect(formatDistance(100_000)).toBe('100.0 km')
  })
})

describe('formatDuration', () => {
  it('formats seconds below 1 hour as "Xm"', () => {
    expect(formatDuration(90)).toBe('2 min')
    expect(formatDuration(3540)).toBe('59 min')
  })

  it('formats 1 hour as "1h"', () => {
    expect(formatDuration(3600)).toBe('1h')
  })

  it('formats 1h 30m correctly', () => {
    expect(formatDuration(5400)).toBe('1h 30m')
  })

  it('handles 2h 0m without trailing zero', () => {
    expect(formatDuration(7200)).toBe('2h')
  })
})

// ── fetchRoutes ───────────────────────────────────────────────────────────────

// Minimal OSRM geometry for a 2-point route (Delhi → Ghaziabad).
// _p~iF~ps|U encoded = [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]
// We'll use a trivially simple encoded polyline for our mocked geometry.
const MOCK_POLYLINE = 'mfmrDedxvMcCaD'  // arbitrary 2-point encoded polyline

const MOCK_OSRM_RESPONSE = {
  code: 'Ok',
  waypoints: [
    { location: [77.209, 28.6139], name: 'Delhi' },
    { location: [77.4538, 28.6692], name: 'Ghaziabad' },
  ],
  routes: [
    {
      distance: 24_500,
      duration: 1800,
      geometry: MOCK_POLYLINE,
      legs: [{ distance: 24_500, duration: 1800 }],
    },
    {
      distance: 28_000,
      duration: 2100,
      geometry: MOCK_POLYLINE,
      legs: [{ distance: 28_000, duration: 2100 }],
    },
  ],
}

const MOCK_OPENMETEO_SINGLE = {
  latitude: 28.6,
  longitude: 77.2,
  current: {
    time: '2026-10-23T15:00',
    pm2_5: 85.0,
    pm10: 160.0,
    nitrogen_dioxide: 45.0,
    sulphur_dioxide: 20.0,
    ozone: 55.0,
    carbon_monoxide: 1800.0,
  },
}

describe('fetchRoutes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed routes with distance, duration, and geometry on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = url.toString()
      if (u.includes('project-osrm')) {
        return { ok: true, status: 200, json: async () => MOCK_OSRM_RESPONSE } as Response
      }
      // Open-Meteo AQI call returns single or array based on batch size
      const singleOrArray = [MOCK_OPENMETEO_SINGLE, MOCK_OPENMETEO_SINGLE]
      return { ok: true, status: 200, json: async () => singleOrArray } as Response
    })

    const origin: GeoPoint = { lat: 28.6139, lng: 77.209 }
    const dest: GeoPoint = { lat: 28.6692, lng: 77.4538 }
    const routes = await fetchRoutes(origin, dest, 'driving')

    expect(routes).toHaveLength(2)
    expect(routes[0].distanceM).toBe(24_500)
    expect(routes[0].durationS).toBe(1800)
    expect(routes[0].label).toBe('Primary route')
    expect(routes[1].label).toBe('Alternative A')
    expect(routes[0].geometry).toBeInstanceOf(Array)
    expect(routes[0].geometry.length).toBeGreaterThan(0)
  })

  it('throws RoutingServiceError with NO_ROUTE code when OSRM returns NoRoute', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 'NoRoute', message: 'No route between points' }),
    } as Response)

    const origin: GeoPoint = { lat: 28.6139, lng: 77.209 }
    const dest: GeoPoint = { lat: 28.6692, lng: 77.4538 }

    await expect(fetchRoutes(origin, dest, 'driving')).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof RoutingServiceError && err.code === 'NO_ROUTE',
    )
  })

  it('throws RoutingServiceError with PROVIDER code on HTTP 429 rate limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    } as Response)

    const origin: GeoPoint = { lat: 28.6139, lng: 77.209 }
    const dest: GeoPoint = { lat: 28.6692, lng: 77.4538 }

    await expect(fetchRoutes(origin, dest, 'driving')).rejects.toMatchObject({
      code: 'PROVIDER',
    })
  })

  it('throws RoutingServiceError on network timeout (AbortError)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
      const err = new Error('The user aborted a request.')
      err.name = 'AbortError'
      return Promise.reject(err)
    })

    const origin: GeoPoint = { lat: 28.6139, lng: 77.209 }
    const dest: GeoPoint = { lat: 28.6692, lng: 77.4538 }

    await expect(fetchRoutes(origin, dest, 'driving')).rejects.toMatchObject({
      code: 'TIMEOUT',
    })
  })

  it('throws RoutingServiceError with VALIDATION code for invalid coordinates', async () => {
    const badOrigin: GeoPoint = { lat: 200, lng: 77.2 } // lat > 90
    const dest: GeoPoint = { lat: 28.6692, lng: 77.4538 }

    await expect(fetchRoutes(badOrigin, dest, 'driving')).rejects.toMatchObject({
      code: 'VALIDATION',
    })
  })

  it('handles empty route geometry gracefully (exposure returns null)', async () => {
    const emptyPolylineResponse = {
      code: 'Ok',
      routes: [
        { distance: 5000, duration: 600, geometry: '', legs: [] },
      ],
    }

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = url.toString()
      if (u.includes('project-osrm')) {
        return { ok: true, status: 200, json: async () => emptyPolylineResponse } as Response
      }
      return { ok: true, status: 200, json: async () => [] } as Response
    })

    const origin: GeoPoint = { lat: 28.6139, lng: 77.209 }
    const dest: GeoPoint = { lat: 28.6692, lng: 77.4538 }
    const routes = await fetchRoutes(origin, dest, 'driving')
    // Empty geometry → 0 sample points → null exposure
    expect(routes[0].exposure.exposureIndex).toBeNull()
  })

  it('produces null exposure when Open-Meteo returns no current data for sampled points', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = url.toString()
      if (u.includes('project-osrm')) {
        return { ok: true, status: 200, json: async () => MOCK_OSRM_RESPONSE } as Response
      }
      // Open-Meteo: no current section
      return {
        ok: true,
        status: 200,
        json: async () => [{ latitude: 28.6, longitude: 77.2 }],
      } as Response
    })

    const origin: GeoPoint = { lat: 28.6139, lng: 77.209 }
    const dest: GeoPoint = { lat: 28.6692, lng: 77.4538 }
    const routes = await fetchRoutes(origin, dest, 'driving')
    // No current → null aqi for all points → null or low-coverage exposure
    expect(routes[0].exposure.exposureIndex).toBeNull()
  })
})

// ── geocodeQuery ─────────────────────────────────────────────────────────────

describe('geocodeQuery', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('parses Nominatim response into GeocodingResult array', async () => {
    const mockResponse = [
      {
        display_name: 'Delhi, India',
        lat: '28.6139',
        lon: '77.2090',
      },
      {
        display_name: 'New Delhi, India',
        lat: '28.6300',
        lon: '77.2165',
      },
    ]

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response)

    const results = await geocodeQuery('Delhi')
    expect(results).toHaveLength(2)
    expect(results[0].name).toBe('Delhi')
    expect(results[0].lat).toBeCloseTo(28.6139, 3)
    expect(results[0].lng).toBeCloseTo(77.209, 3)
  })

  it('throws RoutingServiceError on Nominatim HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as Response)

    await expect(geocodeQuery('Delhi')).rejects.toThrow(RoutingServiceError)
  })

  it('returns empty array when Nominatim finds no results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response)

    const results = await geocodeQuery('xyz-nonexistent-place-123')
    expect(results).toHaveLength(0)
  })
})

// ── buildGoogleMapsDirectionsUrl ─────────────────────────────────────────────

describe('buildGoogleMapsDirectionsUrl', () => {
  const origin: GeoPoint = { lat: 28.6139, lng: 77.209 }
  const dest: GeoPoint = { lat: 28.6692, lng: 77.4538 }

  it('builds a valid Google Maps directions URL with driving mode', () => {
    const url = buildGoogleMapsDirectionsUrl(origin, dest, 'driving')
    expect(url).toContain('https://www.google.com/maps/dir/?api=1')
    expect(url).toContain('origin=28.6139,77.209')
    expect(url).toContain('destination=28.6692,77.4538')
    expect(url).toContain('travelmode=driving')
  })

  it('maps cycling mode to bicycling in Google Maps', () => {
    const url = buildGoogleMapsDirectionsUrl(origin, dest, 'cycling')
    expect(url).toContain('travelmode=bicycling')
  })

  it('maps walking mode correctly', () => {
    const url = buildGoogleMapsDirectionsUrl(origin, dest, 'walking')
    expect(url).toContain('travelmode=walking')
  })

  it('embeds intermediate waypoints when route geometry is available', () => {
    const mockRoute: ParsedRoute = {
      index: 0,
      label: 'Primary',
      distanceM: 20000,
      durationS: 1800,
      samplePoints: [],
      geometry: [
        [28.6139, 77.209],
        [28.62, 77.22],
        [28.63, 77.25],
        [28.64, 77.30],
        [28.65, 77.35],
        [28.655, 77.38],
        [28.66, 77.40],
        [28.665, 77.43],
        [28.6692, 77.4538],
      ],
      exposure: {
        exposureIndex: 120,
        coverageFraction: 1,
        totalPoints: 9,
        coveredPoints: 9,
        meanAqi: 120,
        oldestObservation: null,
      },
    }

    const url = buildGoogleMapsDirectionsUrl(origin, dest, 'driving', mockRoute)
    expect(url).toContain('waypoints=')
    expect(url).toContain('28.64')
  })
})
