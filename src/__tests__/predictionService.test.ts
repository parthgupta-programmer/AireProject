import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getPrediction, PredictionServiceError } from '@/services/predictionService'

describe('predictionService', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('successfully returns prediction data when backend succeeds', async () => {
    const mockResponse = {
      locationId: 'delhi',
      generatedAt: '2026-10-23T12:00:00Z',
      modelVersion: 'xgb-delta-2026',
      series: [
        { timestamp: '2026-10-23T12:00:00Z', aqi: 150, low: 140, high: 160 },
        { timestamp: '2026-10-23T13:00:00Z', aqi: 155, low: 142, high: 168 },
      ],
      horizons: [
        { hours: 1, targetTime: '2026-10-23T13:00:00Z', aqi: 155, low: 142, high: 168, confidence: 0.9 },
        { hours: 3, targetTime: '2026-10-23T15:00:00Z', aqi: 160, low: 145, high: 175, confidence: 0.85 },
      ],
      factors: [
        { id: 'wind', label: 'Light winds', impact: 'raises', weight: 0.35, detail: 'Pollutants accumulating.' },
      ],
      insight: 'AQI expected to rise slightly over the next few hours.',
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    })

    const result = await getPrediction('delhi')
    expect(result).not.toBeNull()
    expect(result?.locationId).toBe('delhi')
    expect(result?.modelVersion).toBe('xgb-delta-2026')
    expect(result?.horizons).toHaveLength(2)
  })

  it('returns null when backend responds with 404 (unsupported city)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'City not found' }),
    })

    const result = await getPrediction('unknown_city')
    expect(result).toBeNull()
  })

  it('throws PredictionServiceError when backend returns a 500 error (no silent fallback)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Internal server error' }),
    })

    await expect(getPrediction('delhi')).rejects.toThrow(PredictionServiceError)
  })

  it('throws PredictionServiceError when backend is unreachable / network fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network connection refused'))

    await expect(getPrediction('delhi')).rejects.toThrow(PredictionServiceError)
    await expect(getPrediction('delhi')).rejects.toThrow(/Failed to connect to ML backend/)
  })
})
