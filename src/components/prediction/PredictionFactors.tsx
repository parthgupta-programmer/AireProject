import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { FactorImpact, PredictionFactor } from '@/types/prediction'

const IMPACT: Record<FactorImpact, { label: string; icon: typeof Minus }> = {
  raises: { label: 'Raises AQI', icon: ArrowUpRight },
  lowers: { label: 'Lowers AQI', icon: ArrowDownRight },
  neutral: { label: 'Little effect', icon: Minus },
}

export function PredictionFactors({ factors, className }: { factors: PredictionFactor[]; className?: string }) {
  const sorted = [...factors].sort((a, b) => b.weight - a.weight)
  const max = sorted[0]?.weight ?? 1

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>What’s influencing this</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">The model didn’t share its factors for this estimate.</p>
        ) : (
          <ul className="space-y-4">
            {sorted.map((f) => {
              const { label, icon: Icon } = IMPACT[f.impact]
              return (
                <li key={f.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      {f.label}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
                  </div>
                  {f.detail && <p className="mt-0.5 pl-6 text-sm text-muted-foreground">{f.detail}</p>}
                  <div aria-hidden className="ml-6 mt-2 h-1 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${(f.weight / max) * 100}%` }} />
                  </div>
                  <span className="sr-only">Influence {Math.round((f.weight / max) * 100)} percent of the strongest factor.</span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function PredictionFactorsSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-1 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
