const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Date and time for tooltips, e.g. "Tue 29 Sep, 6:00 PM". */
export const formatMoment = (t: number) =>
  new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Even Y ticks (0, 50, 100…) so the axis reads cleanly. */
export function niceYTicks(maxValue: number) {
  const top = Math.ceil((maxValue + 10) / 50) * 50
  const step = top <= 250 ? 50 : 100
  const end = Math.ceil(top / step) * step
  return Array.from({ length: end / step + 1 }, (_, i) => i * step)
}

/** Round local-time ticks whose spacing adapts to the span, from a few hours to several days. */
export function buildTimeTicks(start: number, end: number) {
  const span = end - start
  const stepH = span <= 8 * HOUR ? 2 : span <= 14 * HOUR ? 3 : span <= 20 * HOUR ? 4 : span <= 40 * HOUR ? 6 : span <= 4 * DAY ? 12 : 24
  const d = new Date(start)
  d.setMinutes(0, 0, 0)
  while (d.getTime() < start || d.getHours() % stepH !== 0) d.setHours(d.getHours() + 1)
  const ticks: number[] = []
  while (d.getTime() <= end) {
    ticks.push(d.getTime())
    d.setHours(d.getHours() + stepH)
  }
  return ticks
}

/** Hour of day for short spans, weekday and date for multi-day spans. */
export function formatAxisTime(t: number, start: number, end: number) {
  const d = new Date(t)
  return end - start > 2 * DAY
    ? d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })
    : d.toLocaleTimeString([], { hour: 'numeric' })
}
