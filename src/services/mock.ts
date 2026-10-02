/**
 * Shared helpers for the mock services. Delete with the mocks once real APIs exist.
 *
 * Test states by adding a query string, e.g. http://localhost:5173/insights?mock=nopredict
 * (the flag is read once on page load, so reload after changing it)
 *
 *   Air quality     error · flaky · stale · fast · partial · nopollutants · nohistory
 *   Predictions     predicterror   prediction requests fail
 *                   nopredict      the model has no estimate for this location
 *                   noconfidence   the model does not supply a confidence value
 *                   nofactors      the model does not supply influencing factors
 *                   predictstale   the prediction was generated 25 minutes ago
 *   Either          error fails everything · flaky works for 20 s, then fails
 */
export const FLAG = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('mock')
const LOADED_AT = Date.now()

export class MockRequestError extends Error {}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Artificial latency, plus the failure modes that apply to every mock request. */
export async function simulateNetwork(extraMs = 0) {
  await sleep(450 + Math.random() * 450 + extraMs)
  if (FLAG === 'error' || (FLAG === 'flaky' && Date.now() - LOADED_AT > 20_000)) {
    throw new MockRequestError('Mock request failed')
  }
}

export function hashString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

// mulberry32, one step: deterministic 0–1 value from an integer seed
export function rand01(seed: number) {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
