import { AlertTriangle, HeartPulse, ShieldCheck, Users } from 'lucide-react'
import { getAqiCategory } from '@/lib/aqi'
import { AQI_ORDER, CONDITIONS, HIGH_RISK_GROUPS, LONG_TERM_RISKS, MEASURES } from '@/lib/healthInfo'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AqiBadge } from './AqiBadge'

function Heading({ icon: Icon, children }: { icon: typeof ShieldCheck; children: string }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
      <Icon aria-hidden className="size-4 text-primary" />
      {children}
    </h3>
  )
}

/** Health block for the Overview page: what to do, what can go wrong, and who is most at risk at the current AQI. */
export function AqiHealthInfo({ aqi, locationName, className }: { aqi: number; locationName: string; className?: string }) {
  const cat = getAqiCategory(aqi)
  const level = AQI_ORDER.indexOf(cat.key)

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Health and safety</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">What today’s air in {locationName} means for you</p>
        </div>
        <AqiBadge aqi={aqi} />
      </CardHeader>
      <CardContent className="grid gap-8 pt-4 lg:grid-cols-12">
        <section className="lg:col-span-4">
          <Heading icon={ShieldCheck}>Measures to take now</Heading>
          <ul className="space-y-2.5 text-sm">
            {MEASURES[cat.key].map((m) => (
              <li key={m} className="flex gap-2.5">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-5">
          <Heading icon={HeartPulse}>Health problems linked to polluted air</Heading>
          <ul className="divide-y">
            {CONDITIONS.map((c) => {
              const active = level >= AQI_ORDER.indexOf(c.from)
              return (
                <li key={c.name} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                  <Badge variant={active ? 'primary' : 'outline'} className="shrink-0">
                    {active ? 'Possible now' : 'At higher AQI'}
                  </Badge>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Long-term exposure</span> also raises the risk of:{' '}
            {LONG_TERM_RISKS.map((r) => r.toLowerCase()).join('; ')}.
          </p>
        </section>

        <div className="space-y-6 lg:col-span-3">
          <section>
            <Heading icon={Users}>Most at risk</Heading>
            <ul className="space-y-1.5 text-sm">
              {HIGH_RISK_GROUPS.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </section>
          <section className={cn('rounded-md bg-muted p-3 text-xs', level < 2 && 'opacity-80')}>
            <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
              <AlertTriangle aria-hidden className="size-3.5" />
              See a doctor if you have
            </p>
            <p className="text-muted-foreground">
              Trouble breathing, chest pain or tightness, a fast heartbeat, fainting, or a cough or wheeze that keeps
              getting worse.
            </p>
          </section>
        </div>
      </CardContent>
      <p className="border-t px-5 py-3 text-xs text-muted-foreground">
        General guidance only, not medical advice. Poor air does not itself “spread” disease, but it weakens the lungs and
        makes infections and existing conditions worse.
      </p>
    </Card>
  )
}

export function AqiHealthInfoSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="grid gap-8 pt-4 lg:grid-cols-12">
        <Skeleton className="h-48 lg:col-span-4" />
        <Skeleton className="h-48 lg:col-span-5" />
        <Skeleton className="h-48 lg:col-span-3" />
      </CardContent>
    </Card>
  )
}
