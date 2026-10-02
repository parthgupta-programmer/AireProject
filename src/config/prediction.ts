/** Predictions older than this are flagged as possibly outdated. */
export const PREDICTION_STALE_AFTER_MS = 15 * 60 * 1000

/** Horizon shown first when the backend offers it; otherwise the first one available. */
export const DEFAULT_HORIZON_HOURS = 6

/** How far back the "recorded" part of the prediction chart reaches, relative to the horizon. */
export const lookbackHours = (horizonHours: number) => Math.max(3, Math.round(horizonHours / 2))
