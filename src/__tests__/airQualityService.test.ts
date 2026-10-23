import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AirQualityServiceError,
  getCurrentAirQuality,
  getDefaultLocation,
  getNationalAirQuality,
  getAqiHistory,
  isKnownLocation,
  searchLocations,
} from '@/services/airQualityService'
import { clearOpenMeteoCache } from '@/services/openMeteoService'

describe('AirQualityService Location Utilities', () => {
  it('provides a default location with valid coordinates', () => {
    const loc = getDefaultLocation()
    expect(loc).toBeDefined()
    expect(loc.id).toBe('ghaziabad')
    expect(loc.latitude).toBeCloseTo(28.6692, 2)
    expect(loc.longitude).toBeCloseTo(77.4538, 2)
  })

  it('validates known vs unknown location IDs', () => {
    expect(isKnownLocation('delhi')).toBe(true)
    expect(isKnownLocation('mumbai')).toBe(true)
    expect(isKnownLocation('atlantis')).toBe(false)
  })

  it('searches locations case-insensitively', async () => {
    const results = await searchLocations('delhi')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((l) => l.name === 'Delhi')).toBe(true)
  })
})

describe('Open-Meteo Air Quality Data Mapping & Error Handling', () => {
  beforeEach(() => {
    clearOpenMeteoCache()
    vi.restoreAllMocks()
  })

  it('successfully fetches and maps real Open-Meteo response into AirQualityData', async () => {
    const mockResponse = {
      latitude: 28.6,
      longitude: 77.2,
      current: {
        time: '2026-10-23T15:00',
        pm2_5: 85.0,
        pm10: 160.0,
        nitrogen_dioxide: 45.0,
        sulphur_dioxide: 20.0,
        ozone: 55.0,
        carbon_monoxide: 1800.0, // 1800 ug/m3 -> 1.8 mg/m3
      },
      hourly: {
        time: ['2026-10-23T14:00', '2026-10-23T15:00'],
        pm2_5: [80.0, 85.0],
        pm10: [150.0, 160.0],
        nitrogen_dioxide: [40.0, 45.0],
        sulphur_dioxide: [18.0, 20.0],
        ozone: [50.0, 55.0],
        carbon_monoxide: [1700.0, 1800.0],
      },
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response)

    const data = await getCurrentAirQuality('delhi')

    expect(data.location.id).toBe('delhi')
    expect(data.pollutants.pm25).toBe(85)
    expect(data.pollutants.pm10).toBe(160)
    expect(data.pollutants.co).toBe(1.8) // converted from 1800 ug/m3 to 1.8 mg/m3
    expect(data.aqi).toBeGreaterThan(0)
    expect(data.previousAqi).toBeDefined()
    expect(data.timestamp).toContain('2026-10-23T15:00:00.000Z')
  })

  it('throws AirQualityServiceError on HTTP 500 without falling back to mock data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response)

    await expect(getCurrentAirQuality('delhi')).rejects.toThrow(AirQualityServiceError)
  })

  it('throws AirQualityServiceError on network timeout or fetch abort', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'))

    await expect(getCurrentAirQuality('delhi')).rejects.toThrow(AirQualityServiceError)
  })

  it('rejects unknown location ids cleanly', async () => {
    await expect(getCurrentAirQuality('nonexistent-place')).rejects.toThrow(AirQualityServiceError)
  })

  it('caches current readings to prevent duplicate network calls within TTL', async () => {
    const mockResponse = {
      latitude: 28.6,
      longitude: 77.2,
      current: {
        time: '2026-10-23T15:00',
        pm2_5: 50.0,
        pm10: 90.0,
      },
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response)

    const first = await getCurrentAirQuality('delhi')
    const second = await getCurrentAirQuality('delhi')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(first.aqi).toBe(second.aqi)
  })

  it('maps historical hourly observations correctly for 24h range', async () => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 3600_000)
    const twoHoursAgo = new Date(now.getTime() - 7200_000)

    const mockHistory = {
      latitude: 28.6,
      longitude: 77.2,
      hourly: {
        time: [twoHoursAgo.toISOString().slice(0, 16), oneHourAgo.toISOString().slice(0, 16)],
        pm2_5: [60.0, 75.0],
        pm10: [120.0, 140.0],
        nitrogen_dioxide: [30.0, 40.0],
        sulphur_dioxide: [15.0, 20.0],
        ozone: [40.0, 50.0],
        carbon_monoxide: [1000.0, 1200.0],
      },
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockHistory,
    } as Response)

    const history = await getAqiHistory('delhi', '24h')
    expect(history.locationId).toBe('delhi')
    expect(history.range).toBe('24h')
    expect(history.points.length).toBe(2)
    expect(history.points[0].aqi).toBeGreaterThan(0)
  })

  it('fetches national air quality across locations in batches', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      // Mock batch of 30 responses
      const batchData = Array.from({ length: 30 }, () => ({
        latitude: 28.6,
        longitude: 77.2,
        current: {
          time: '2026-10-23T15:00',
          pm2_5: 65.0,
          pm10: 110.0,
        },
      }))
      return {
        ok: true,
        status: 200,
        json: async () => batchData,
      } as Response
    })

    const national = await getNationalAirQuality()
    expect(Array.isArray(national)).toBe(true)
    expect(national.length).toBeGreaterThan(0)
    expect(national[0].aqi).toBeGreaterThan(0)
  })
})
