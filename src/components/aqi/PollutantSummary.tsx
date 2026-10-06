import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { POLLUTANTS } from '@/lib/pollutants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import type { PollutantKey, PollutantReadings } from '@/types/airQuality'
import { PollutantItem } from './PollutantItem'

interface Props {
  pollutants: PollutantReadings
  /** Start with every explanation open (used on the detailed Air Quality page). */
  defaultExpanded?: boolean
  className?: string
}

export function PollutantSummary({ pollutants, defaultExpanded = false, className }: Props) {
  const [openKeys, setOpenKeys] = useState<Set<PollutantKey>>(
    () => new Set(defaultExpanded ? POLLUTANTS.map((p) => p.key) : []),
  )
  const toggle = (key: PollutantKey) =>
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const hasAny = POLLUTANTS.some((p) => pollutants[p.key] !== undefined)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Pollutants</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-3 pt-1">
        {hasAny ? (
          <ul className="divide-y">
            {POLLUTANTS.map((meta) => (
              <PollutantItem
                key={meta.key}
                meta={meta}
                value={pollutants[meta.key]}
                open={openKeys.has(meta.key)}
                onToggle={() => toggle(meta.key)}
              />
            ))}
          </ul>
        ) : (
          <EmptyState icon={FlaskConical} title="Pollutant data unavailable" className="mb-2 border-0 py-10" />
        )}
      </CardContent>
    </Card>
  )
}

export function PollutantSummarySkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-20" />
      </CardHeader>
      <CardContent className="space-y-1 px-5 pb-3 pt-1">
        {POLLUTANTS.map((p) => (
          <div key={p.key} className="flex h-[3.25rem] items-center gap-3">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-1 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
