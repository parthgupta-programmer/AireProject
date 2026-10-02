import type { HistoryRange } from '@/types/airQuality'

/** How often the app asks for a fresh reading. */
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000

/** A reading older than this (two missed cycles) is flagged as possibly outdated. */
export const STALE_AFTER_MS = 2 * REFRESH_INTERVAL_MS

export const HISTORY_RANGES: { value: HistoryRange; label: string; caption: string }[] = [
  { value: '24h', label: '24H', caption: 'Past 24 hours' },
  { value: '3d', label: '3D', caption: 'Past 3 days' },
  { value: '7d', label: '7D', caption: 'Past 7 days' },
]
