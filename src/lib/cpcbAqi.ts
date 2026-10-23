/**
 * India Central Pollution Control Board (CPCB) National Air Quality Index (NAQI)
 * Sub-index and Composite AQI Calculation Module.
 *
 * Reference:
 * Central Pollution Control Board, Ministry of Environment, Forest and Climate Change,
 * Government of India: "National Air Quality Index" (NAQI) Guidelines (2014).
 *
 * Official CPCB AQI Calculation Rules:
 * 1. Sub-index calculation for each pollutant:
 *    Ip = I_low + ((I_high - I_low) / (B_high - B_low)) * (Cp - B_low)
 * 2. Overall AQI = max(sub-indices).
 * 3. CPCB Data Sufficiency Criteria:
 *    - An official NAQI requires at least THREE pollutants to be monitored.
 *    - At least ONE of the three pollutants MUST be either PM2.5 or PM10.
 *    - If these criteria are not met, a strictly compliant CPCB AQI cannot be declared.
 *
 * Units expected:
 * - PM2.5: ug/m3 (24-hr avg / 1-hr proxy)
 * - PM10: ug/m3 (24-hr avg / 1-hr proxy)
 * - NO2: ug/m3 (24-hr avg / 1-hr proxy)
 * - SO2: ug/m3 (24-hr avg / 1-hr proxy)
 * - CO: mg/m3 (8-hr avg / 1-hr proxy)  <-- Note: Open-Meteo returns ug/m3, divide by 1000!
 * - O3: ug/m3 (8-hr avg / 1-hr proxy)
 */

import type { PollutantKey, PollutantReadings } from '@/types/airQuality'

type Breakpoint = [cLow: number, cHigh: number, iLow: number, iHigh: number]

export const CPCB_BREAKPOINTS: Record<PollutantKey, Breakpoint[]> = {
  pm25: [
    [0, 30, 0, 50],
    [31, 60, 51, 100],
    [61, 90, 101, 200],
    [91, 120, 201, 300],
    [121, 250, 301, 400],
    [251, 500, 401, 500],
  ],
  pm10: [
    [0, 50, 0, 50],
    [51, 100, 51, 100],
    [101, 250, 101, 200],
    [251, 350, 201, 300],
    [351, 430, 301, 400],
    [431, 600, 401, 500],
  ],
  no2: [
    [0, 40, 0, 50],
    [41, 80, 51, 100],
    [81, 180, 101, 200],
    [181, 280, 201, 300],
    [281, 400, 301, 400],
    [401, 800, 401, 500],
  ],
  so2: [
    [0, 40, 0, 50],
    [41, 80, 51, 100],
    [81, 380, 101, 200],
    [381, 800, 201, 300],
    [801, 1600, 301, 400],
    [1601, 2100, 401, 500],
  ],
  co: [
    [0, 1.0, 0, 50],
    [1.1, 2.0, 51, 100],
    [2.1, 10.0, 101, 200],
    [10.1, 17.0, 201, 300],
    [17.1, 34.0, 301, 400],
    [34.1, 50.0, 401, 500],
  ],
  o3: [
    [0, 50, 0, 50],
    [51, 100, 51, 100],
    [101, 168, 101, 200],
    [169, 208, 201, 300],
    [209, 748, 301, 400],
    [749, 1000, 401, 500],
  ],
}

/**
 * Calculates the CPCB sub-index for a single pollutant.
 * Returns null if concentration is negative, NaN, or undefined.
 * If concentration exceeds the maximum breakpoint, returns 500.
 */
export function calculateSubIndex(pollutant: PollutantKey, concentration: number | undefined): number | null {
  if (concentration === undefined || concentration === null || Number.isNaN(concentration) || concentration < 0) {
    return null
  }

  const table = CPCB_BREAKPOINTS[pollutant]
  if (!table) return null

  for (const [cLow, cHigh, iLow, iHigh] of table) {
    if (concentration >= cLow && concentration <= cHigh) {
      const sub = iLow + ((iHigh - iLow) / (cHigh - cLow)) * (concentration - cLow)
      return Math.round(sub)
    }
  }

  // If concentration exceeds the highest defined threshold, cap at 500
  if (concentration > table[table.length - 1][1]) {
    return 500
  }

  return null
}

export interface AqiCalculationResult {
  aqi: number | null
  subIndices: Partial<Record<PollutantKey, number>>
  dominantPollutant: PollutantKey | null
  isOfficialCompliant: boolean
  availablePollutantCount: number
}

/**
 * Calculates overall India CPCB AQI from a dictionary of pollutant readings.
 *
 * @param pollutants - Object containing pollutant readings in standard units (CO in mg/m3).
 * @param options - Configuration options:
 *   - strictThreePollutantRule: If true, returns aqi = null unless >=3 pollutants and (PM2.5 or PM10) are present.
 *                               If false (default), calculates best available max sub-index if at least 1 valid reading exists.
 */
export function calculateCpcbAqi(
  pollutants: PollutantReadings,
  options: { strictThreePollutantRule?: boolean } = {},
): AqiCalculationResult {
  const subIndices: Partial<Record<PollutantKey, number>> = {}
  let maxSubIndex = -1
  let dominant: PollutantKey | null = null

  const keys: PollutantKey[] = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3']
  let count = 0

  for (const key of keys) {
    const val = pollutants[key]
    if (val !== undefined && val !== null && !Number.isNaN(val) && val >= 0) {
      const sub = calculateSubIndex(key, val)
      if (sub !== null) {
        subIndices[key] = sub
        count++
        if (sub > maxSubIndex) {
          maxSubIndex = sub
          dominant = key
        }
      }
    }
  }

  const hasParticulate = subIndices.pm25 !== undefined || subIndices.pm10 !== undefined
  const isOfficialCompliant = count >= 3 && hasParticulate

  if (options.strictThreePollutantRule && !isOfficialCompliant) {
    return {
      aqi: null,
      subIndices,
      dominantPollutant: null,
      isOfficialCompliant: false,
      availablePollutantCount: count,
    }
  }

  return {
    aqi: maxSubIndex >= 0 ? maxSubIndex : null,
    subIndices,
    dominantPollutant: dominant,
    isOfficialCompliant,
    availablePollutantCount: count,
  }
}
