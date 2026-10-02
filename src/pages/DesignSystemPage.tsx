import { Inbox } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardTitle, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AqiBadge } from '@/components/aqi/AqiBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { AQI_BG, AQI_CATEGORIES } from '@/lib/aqi'
import { cn } from '@/lib/utils'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
)

export default function DesignSystemPage() {
  return (
    <>
      <PageHeader title="Design system" description="Internal reference. Not part of the product." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="AQI scale">
          <div className="flex h-2 overflow-hidden rounded-full">
            {AQI_CATEGORIES.map((c) => <div key={c.key} className={cn('flex-1', AQI_BG[c.key])} />)}
          </div>
          <div className="flex flex-wrap gap-2">
            {[32, 78, 142, 245, 340].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <span className="text-lg font-semibold">{n}</span>
                <AqiBadge aqi={n} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type">
          <p className="text-5xl font-semibold tracking-tight">142</p>
          <p className="text-2xl font-semibold tracking-tight">Limit prolonged outdoor activity</p>
          <p className="text-sm">Body text, 14px. Numbers stay aligned.</p>
          <p className="text-xs text-muted-foreground">Secondary text · Last updated 2 min ago</p>
        </Section>

        <Section title="Actions">
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button size="sm" disabled>Disabled</Button>
          </div>
          <Input placeholder="Search a city" aria-label="Search a city" />
          <div className="flex gap-2">
            <Badge>Neutral</Badge>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </Section>

        <Section title="States">
          <LoadingState />
        </Section>
        <EmptyState icon={Inbox} title="No alerts yet" description="Create one to get notified." />
        <ErrorState onRetry={() => undefined} />
      </div>
    </>
  )
}
