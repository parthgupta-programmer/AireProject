import { describe, expect, it } from 'vitest'
import {
  calculateCpcbAqi,
  calculateSubIndex,
} from '@/lib/cpcbAqi'
import type { PollutantReadings } from '@/types/airQuality'

describe('CPCB NAQI Sub-index Calculations', () => {
  it('calculates PM2.5 sub-index correctly across breakpoint bands', () => {
    // Good: 0 - 30 -> 0 - 50
    expect(calculateSubIndex('pm25', 0)).toBe(0)
    expect(calculateSubIndex('pm25', 15)).toBe(25)
    expect(calculateSubIndex('pm25', 30)).toBe(50)

    // Satisfactory: 31 - 60 -> 51 - 100
    expect(calculateSubIndex('pm25', 45)).toBe(75)
    expect(calculateSubIndex('pm25', 60)).toBe(100)

    // Moderate: 61 - 90 -> 101 - 200
    expect(calculateSubIndex('pm25', 75)).toBe(149)
    expect(calculateSubIndex('pm25', 90)).toBe(200)

    // Poor: 91 - 120 -> 201 - 300
    expect(calculateSubIndex('pm25', 105)).toBe(249)
    expect(calculateSubIndex('pm25', 120)).toBe(300)

    // Very Poor: 121 - 250 -> 301 - 400
    expect(calculateSubIndex('pm25', 250)).toBe(400)

    // Severe: 251 - 500 -> 401 - 500
    expect(calculateSubIndex('pm25', 500)).toBe(500)

    // Beyond 500 -> capped at 500
    expect(calculateSubIndex('pm25', 650)).toBe(500)
  })

  it('calculates PM10 sub-index correctly', () => {
    expect(calculateSubIndex('pm10', 0)).toBe(0)
    expect(calculateSubIndex('pm10', 50)).toBe(50)
    expect(calculateSubIndex('pm10', 100)).toBe(100)
    expect(calculateSubIndex('pm10', 250)).toBe(200)
    expect(calculateSubIndex('pm10', 350)).toBe(300)
    expect(calculateSubIndex('pm10', 430)).toBe(400)
    expect(calculateSubIndex('pm10', 600)).toBe(500)
    expect(calculateSubIndex('pm10', 750)).toBe(500)
  })

  it('calculates CO sub-index with mg/m3 units', () => {
    expect(calculateSubIndex('co', 0)).toBe(0)
    expect(calculateSubIndex('co', 1.0)).toBe(50)
    expect(calculateSubIndex('co', 2.0)).toBe(100)
    expect(calculateSubIndex('co', 10.0)).toBe(200)
    expect(calculateSubIndex('co', 17.0)).toBe(300)
    expect(calculateSubIndex('co', 34.0)).toBe(400)
    expect(calculateSubIndex('co', 50.0)).toBe(500)
  })

  it('calculates NO2, SO2, and O3 sub-indices correctly', () => {
    expect(calculateSubIndex('no2', 40)).toBe(50)
    expect(calculateSubIndex('no2', 80)).toBe(100)
    expect(calculateSubIndex('no2', 180)).toBe(200)

    expect(calculateSubIndex('so2', 40)).toBe(50)
    expect(calculateSubIndex('so2', 80)).toBe(100)

    expect(calculateSubIndex('o3', 50)).toBe(50)
    expect(calculateSubIndex('o3', 100)).toBe(100)
  })

  it('returns null for invalid or missing pollutant readings', () => {
    expect(calculateSubIndex('pm25', undefined)).toBeNull()
    expect(calculateSubIndex('pm25', -5)).toBeNull()
    expect(calculateSubIndex('pm25', Number.NaN)).toBeNull()
  })
})

describe('Overall CPCB AQI Aggregation & Compliance', () => {
  it('selects the maximum sub-index as overall AQI', () => {
    const readings: PollutantReadings = {
      pm25: 110, // Poor: ~265
      pm10: 90,  // Satisfactory: ~90
      no2: 30,   // Good: ~38
      so2: 15,   // Good: ~19
      co: 1.5,   // Satisfactory: ~74
      o3: 40,    // Good: ~40
    }

    const res = calculateCpcbAqi(readings)
    expect(res.aqi).toBeGreaterThanOrEqual(250)
    expect(res.aqi).toBeLessThanOrEqual(280)
    expect(res.dominantPollutant).toBe('pm25')
    expect(res.isOfficialCompliant).toBe(true)
    expect(res.availablePollutantCount).toBe(6)
  })

  it('validates CPCB 3-pollutant data sufficiency rule', () => {
    // Only 2 pollutants available
    const insufficient: PollutantReadings = {
      pm25: 50,
      pm10: 80,
    }

    const strictResult = calculateCpcbAqi(insufficient, { strictThreePollutantRule: true })
    expect(strictResult.isOfficialCompliant).toBe(false)
    expect(strictResult.aqi).toBeNull()

    const lenientResult = calculateCpcbAqi(insufficient)
    expect(lenientResult.isOfficialCompliant).toBe(false)
    expect(lenientResult.aqi).not.toBeNull() // lenient mode produces best-available estimate
  })

  it('requires at least one particulate (PM2.5 or PM10) for official compliance', () => {
    // 3 gases but NO particulates
    const gasesOnly: PollutantReadings = {
      no2: 50,
      so2: 25,
      co: 1.2,
    }

    const res = calculateCpcbAqi(gasesOnly, { strictThreePollutantRule: true })
    expect(res.isOfficialCompliant).toBe(false)
    expect(res.aqi).toBeNull()
  })

  it('returns null when all pollutant fields are empty or invalid', () => {
    const empty: PollutantReadings = {}
    const res = calculateCpcbAqi(empty)
    expect(res.aqi).toBeNull()
    expect(res.dominantPollutant).toBeNull()
    expect(res.availablePollutantCount).toBe(0)
  })
})
