import type { HistoryRange } from '@/types/airQuality'

/** How often the app asks for a fresh reading (updated every 2 minutes, in the 2-5 min range). */
export const REFRESH_INTERVAL_MS = 2 * 60 * 1000

/**
 * Atmospheric monitoring stations publish hourly observations.
 * A reading is considered stale if more than 90 minutes have elapsed without an updated observation.
 */
export const STALE_AFTER_MS = 90 * 60 * 1000

export const HISTORY_RANGES: { value: HistoryRange; label: string; caption: string }[] = [
  { value: '24h', label: '24H', caption: 'Past 24 hours' },
  { value: '3d', label: '3D', caption: 'Past 3 days' },
  { value: '7d', label: '7D', caption: 'Past 7 days' },
]
