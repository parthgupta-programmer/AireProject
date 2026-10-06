import { useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartLine } from 'lucide-react'
import { HISTORY_RANGES } from '@/config/airQuality'
import { useAqiHistory } from '@/hooks/useAqiHistory'
import { AQI_BG, AQI_FILL, getAqiCategory } from '@/lib/aqi'
import { formatMoment, niceYTicks } from '@/lib/chart'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import type { HistoryRange } from '@/types/airQuality'

interface Point {
  t: number
  aqi: number
}

const CHART_HEIGHT = 'h-56 sm:h-64'

// ---- formatting --------------------------------------------------------------

function formatTick(t: number, range: HistoryRange) {
  const d = new Date(t)
  if (range === '24h') return d.toLocaleTimeString([], { hour: 'numeric' })
  if (range === '3d') return d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })
  return d.toLocaleDateString([], { weekday: 'short' })
}

/** Round, evenly spaced ticks in local time: every 6 h for 24H, every midnight otherwise. */
function buildTicks(start: number, end: number, range: HistoryRange) {
  const ticks: number[] = []
  const d = new Date(start)
  if (range === '24h') {
    d.setMinutes(0, 0, 0)
    while (d.getTime() < start || d.getHours() % 6 !== 0) d.setHours(d.getHours() + 1)
    while (d.getTime() <= end) {
      ticks.push(d.getTime())
      d.setHours(d.getHours() + 6)
    }
  } else {
    d.setHours(0, 0, 0, 0)
    if (d.getTime() < start) d.setDate(d.getDate() + 1)
    while (d.getTime() <= end) {
      ticks.push(d.getTime())
      d.setDate(d.getDate() + 1)
    }
  }
  return ticks
}

// ---- pieces ------------------------------------------------------------------

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null
  const { t, aqi } = payload[0].payload
  const cat = getAqiCategory(aqi)
  return (
    <div className="app-glass app-pop rounded-xl px-3 py-2 text-sm">
      <p className="text-xs text-muted-foreground">{formatMoment(t)}</p>
      <p className="mt-0.5 flex items-center gap-2">
        <span aria-hidden className={cn('size-2 rounded-full', AQI_BG[cat.key])} />
        <span className="font-semibold">{aqi}</span>
        <span className="text-muted-foreground">{cat.label}</span>
      </p>
    </div>
  )
}

function TrendPlot({ points, range }: { points: Point[]; range: HistoryRange }) {
  const reduce = useReducedMotion()
  const start = points[0].t
  const last = points[points.length - 1]
  const end = last.t
  const ticks = useMemo(() => buildTicks(start, end, range), [start, end, range])
  const cat = getAqiCategory(last.aqi)
  const yTicks = niceYTicks(Math.max(...points.map((p) => p.aqi)))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={[start, end]}
          ticks={ticks}
          tickFormatter={(v: number) => formatTick(v, range)}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={8}
        />
        <YAxis
          width={36}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          ticks={yTicks}
          domain={[0, yTicks[yTicks.length - 1]]}
        />
        <Tooltip content={<TrendTooltip />} />
        <Area
          type="monotone"
          dataKey="aqi"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, className: 'aqi-active-dot' }}
          isAnimationActive={!reduce}
          animationDuration={600}
        />
        {/* Marker for the current reading, coloured by its category */}
        <ReferenceDot
          x={end}
          y={last.aqi}
          ifOverflow="visible"
          shape={({ cx, cy }: { cx: number; cy: number }) => (
            <circle cx={cx} cy={cy} r={5} strokeWidth={2} className={cn(AQI_FILL[cat.key], 'stroke-card')} />
          )}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  )
}

// ---- main --------------------------------------------------------------------

interface Props {
  locationId: string
  /** Pass the current reading's timestamp so the chart quietly refreshes when new data arrives. */
  refreshKey?: string
  className?: string
}

export function AQITrendChart({ locationId, refreshKey, className }: Props) {
  const [range, setRange] = useState<HistoryRange>('24h')
  const { status, history, retry } = useAqiHistory(locationId, range, refreshKey)
  const caption = HISTORY_RANGES.find((r) => r.value === range)!.caption

  const points = useMemo<Point[]>(
    () => history?.points.map((p) => ({ t: Date.parse(p.timestamp), aqi: p.aqi })) ?? [],
    [history],
  )

  const stats = useMemo(() => {
    if (!points.length) return null
    const values = points.map((p) => p.aqi)
    return {
      low: Math.min(...values),
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      high: Math.max(...values),
      now: values[values.length - 1],
    }
  }, [points])

  const summary = stats
    ? `AQI over the ${caption.toLowerCase()}: low ${stats.low}, average ${stats.avg}, high ${stats.high}. Currently ${stats.now}, ${getAqiCategory(stats.now).label}.`
    : 'AQI history chart'

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>AQI trend</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">{caption}<span className="hidden sm:inline"> · recorded readings</span></p>
        </div>
        <SegmentedControl label="Time range" options={HISTORY_RANGES} value={range} onChange={setRange} />
      </CardHeader>
      <CardContent className="pt-3">
        <div className={cn('aqi-chart', CHART_HEIGHT)}>
          {status === 'loading' && <Skeleton className="size-full" />}
          {status === 'error' && (
            <ErrorState
              title="Trend unavailable"
              description="Please try again."
              onRetry={retry}
              className="h-full justify-center border-0 py-0"
            />
          )}
          {status === 'success' && !points.length && (
            <EmptyState
              icon={ChartLine}
              title="No history yet"
              description="Readings for this location will appear here."
              className="h-full justify-center border-0 py-0"
            />
          )}
          {status === 'success' && points.length > 0 && (
            <div role="img" aria-label={summary} className="size-full">
              <TrendPlot points={points} range={range} />
            </div>
          )}
        </div>
        {stats && status === 'success' && (
          <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
            <Stat label="Low" value={stats.low} />
            <Stat label="Average" value={stats.avg} />
            <Stat label="High" value={stats.high} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AQITrendSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-8 w-28" />
      </CardHeader>
      <CardContent className="pt-3">
        <Skeleton className={CHART_HEIGHT} />
        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-5 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
