import { useMemo } from 'react'
import { useReducedMotion } from 'motion/react'
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { lookbackHours } from '@/config/prediction'
import { useAqiHistory } from '@/hooks/useAqiHistory'
import { AQI_BG, AQI_FILL, getAqiCategory } from '@/lib/aqi'
import { buildTimeTicks, formatAxisTime, formatMoment, niceYTicks } from '@/lib/chart'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AqiPrediction, PredictionHorizon } from '@/types/prediction'

const HOUR = 3_600_000
const HEIGHT = 'h-60 sm:h-72'

interface Row {
  t: number
  observed?: number
  predicted?: number
  band?: [number, number]
}

function Tooltip_({ active, payload, anchor }: { active?: boolean; payload?: { payload: Row }[]; anchor: number }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const isPrediction = row.t > anchor
  const aqi = (isPrediction ? row.predicted : row.observed) ?? row.predicted
  if (aqi === undefined) return null
  const cat = getAqiCategory(aqi)
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm">
      <p className="text-xs text-muted-foreground">
        {row.t === anchor ? 'Now' : isPrediction ? 'AI prediction' : 'Recorded'} · {formatMoment(row.t)}
      </p>
      <p className="mt-0.5 flex items-center gap-2">
        <span aria-hidden className={cn('size-2 rounded-full', AQI_BG[cat.key])} />
        <span className="font-semibold">{aqi}</span>
        <span className="text-muted-foreground">{cat.label}</span>
      </p>
      {isPrediction && row.band && (
        <p className="mt-0.5 text-xs text-muted-foreground">Likely range {row.band[0]}–{row.band[1]}</p>
      )}
    </div>
  )
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <svg width="18" height="4" aria-hidden><line x1="0" y1="2" x2="18" y2="2" strokeWidth="2" className="stroke-primary" /></svg>
        Recorded
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="18" height="4" aria-hidden><line x1="0" y1="2" x2="18" y2="2" strokeWidth="2" strokeDasharray="4 3" className="stroke-ring" /></svg>
        AI prediction
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="h-2.5 w-4 rounded-sm bg-ring/15" />
        Likely range
      </li>
    </ul>
  )
}

interface Props {
  prediction: AqiPrediction
  horizon: PredictionHorizon
  currentAqi: number
  className?: string
}

export function PredictionChart({ prediction, horizon, currentAqi, className }: Props) {
  const reduce = useReducedMotion()
  const { status: historyStatus, history } = useAqiHistory(prediction.locationId, '24h', prediction.generatedAt)

  const anchor = Date.parse(prediction.series[0].timestamp)
  const target = Date.parse(horizon.targetTime)
  const hasBand = prediction.series.some((p) => p.low !== undefined && p.high !== undefined)

  const rows = useMemo<Row[]>(() => {
    const from = anchor - lookbackHours(horizon.hours) * HOUR
    const recorded: Row[] =
      historyStatus === 'success' && history
        ? history.points
            .map((p) => ({ t: Date.parse(p.timestamp), observed: p.aqi }))
            .filter((p) => p.t >= from && p.t < anchor)
        : []
    const first = prediction.series[0]
    const future: Row[] = prediction.series
      .map((p) => ({ t: Date.parse(p.timestamp), predicted: p.aqi, band: [p.low ?? p.aqi, p.high ?? p.aqi] as [number, number] }))
      .filter((p) => p.t > anchor && p.t <= target)
    // The "now" row joins both lines so they meet without a gap
    return [...recorded, { t: anchor, observed: currentAqi, predicted: first.aqi, band: [first.aqi, first.aqi] }, ...future]
  }, [history, historyStatus, prediction, anchor, target, horizon.hours, currentAqi])

  const start = rows[0].t
  const ticks = useMemo(() => buildTimeTicks(start, target), [start, target])
  const yTicks = niceYTicks(Math.max(...rows.map((r) => r.band?.[1] ?? r.predicted ?? r.observed ?? 0)))
  const nowCat = getAqiCategory(currentAqi)
  const targetCat = getAqiCategory(horizon.aqi)

  const summary =
    `AQI is ${currentAqi} now. The model estimates ${horizon.aqi} around ${new Date(target).toLocaleTimeString([], { hour: 'numeric' })}` +
    (horizon.low !== undefined && horizon.high !== undefined ? `, likely between ${horizon.low} and ${horizon.high}.` : '.')

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <CardTitle>Recorded vs predicted</CardTitle>
        <Legend />
      </CardHeader>
      <CardContent className="pt-3">
        <div className={cn('aqi-chart', HEIGHT)}>
          <div role="img" aria-label={summary} className="size-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={[start, target]}
                  ticks={ticks}
                  tickFormatter={(v: number) => formatAxisTime(v, start, target)}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={8}
                />
                <YAxis width={36} tickLine={false} axisLine={false} ticks={yTicks} domain={[0, yTicks[yTicks.length - 1]]} />
                <Tooltip content={<Tooltip_ anchor={anchor} />} />
                {hasBand && (
                  <Area
                    className="pred-band"
                    dataKey="band"
                    type="monotone"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={!reduce}
                    animationDuration={600}
                  />
                )}
                <Line
                  className="obs-line"
                  dataKey="observed"
                  type="monotone"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, className: 'aqi-active-dot' }}
                  isAnimationActive={!reduce}
                  animationDuration={600}
                />
                <Line
                  className="pred-line"
                  dataKey="predicted"
                  type="monotone"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 4, className: 'pred-active-dot' }}
                  isAnimationActive={!reduce}
                  animationDuration={600}
                />
                <ReferenceLine className="now-line" x={anchor} label={{ value: 'Now', position: 'top' }} />
                <ReferenceDot
                  x={anchor}
                  y={currentAqi}
                  ifOverflow="visible"
                  shape={({ cx, cy }: { cx: number; cy: number }) => (
                    <circle cx={cx} cy={cy} r={5} strokeWidth={2} className={cn(AQI_FILL[nowCat.key], 'stroke-card')} />
                  )}
                />
                <ReferenceDot
                  x={target}
                  y={horizon.aqi}
                  ifOverflow="visible"
                  shape={({ cx, cy }: { cx: number; cy: number }) => (
                    <circle cx={cx} cy={cy} r={5} strokeWidth={2} className={cn(AQI_FILL[targetCat.key], 'stroke-card')} />
                  )}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PredictionChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="pt-3">
        <Skeleton className={HEIGHT} />
      </CardContent>
    </Card>
  )
}
