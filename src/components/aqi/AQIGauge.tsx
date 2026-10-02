import { AQI_STROKE, getAqiCategory } from '@/lib/aqi'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { cn } from '@/lib/utils'

const R = 84
const CIRC = 2 * Math.PI * R
const ARC = CIRC * 0.75 // 270° sweep, gap at the bottom

// Each AQI category owns an equal fifth of the ring, so "Poor" never looks like an almost-empty gauge.
const STOPS: [number, number][] = [[0, 0], [50, 0.2], [100, 0.4], [200, 0.6], [300, 0.8], [500, 1]]

function toFraction(aqi: number) {
  const v = Math.min(Math.max(aqi, 0), 500)
  for (let i = 1; i < STOPS.length; i++) {
    const [x1, y1] = STOPS[i]
    if (v <= x1) {
      const [x0, y0] = STOPS[i - 1]
      return y0 + ((y1 - y0) * (v - x0)) / (x1 - x0)
    }
  }
  return 1
}

export function AQIGauge({ aqi, className }: { aqi: number; className?: string }) {
  const cat = getAqiCategory(aqi)
  const filled = ARC * toFraction(aqi)

  return (
    <div
      role="img"
      aria-label={`Air quality index ${aqi}, ${cat.label}`}
      className={cn('relative size-44 sm:size-52', className)}
    >
      <svg viewBox="0 0 200 200" className="size-full" aria-hidden>
        <g transform="rotate(135 100 100)" fill="none" strokeWidth="12" strokeLinecap="round">
          <circle cx="100" cy="100" r={R} className="stroke-border" strokeDasharray={`${ARC} ${CIRC}`} />
          <circle
            cx="100"
            cy="100"
            r={R}
            className={cn('transition-[stroke-dasharray,stroke] duration-700 ease-out', AQI_STROKE[cat.key])}
            strokeDasharray={`${filled} ${CIRC}`}
          />
        </g>
      </svg>
      <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center pb-2">
        <AnimatedNumber value={aqi} className="text-6xl font-semibold leading-none tracking-tight" />
        <span className="mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">AQI</span>
      </div>
    </div>
  )
}
