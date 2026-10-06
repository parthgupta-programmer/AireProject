import { Wind } from 'lucide-react'

import { useAirQualityData } from '@/context/AirQualityContext'
import { useSelectedLocation } from '@/context/LocationContext'

import {
  AQI_BG,
  AQI_CATEGORIES,
  getAqiCategory,
} from '@/lib/aqi'

import {
  AQI_MEANING,
  CLEAN_AIR,
  FAQ,
  POLLUTANT_LESSONS,
  SOURCES,
} from '@/lib/learnContent'

import {
  getPollutantLevel,
  POLLUTANTS,
  type PollutantMeta,
} from '@/lib/pollutants'

import { cn } from '@/lib/utils'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'

import type { AirQualityData } from '@/types/airQuality'

function SectionTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-3 mt-10">
      <h2 className="font-display text-2xl font-semibold">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-0.5 text-sm text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  )
}

/**
 * The pollutant that is furthest above its own "moderate" limit:
 * the one driving today's AQI.
 */
function mainPollutant(
  data: AirQualityData,
): { meta: PollutantMeta; value: number } | null {
  let best: {
    meta: PollutantMeta
    value: number
    ratio: number
  } | null = null

  for (const meta of POLLUTANTS) {
    const value = data.pollutants[meta.key]

    if (value === undefined) continue

    const ratio = value / meta.bounds[1]

    if (!best || ratio > best.ratio) {
      best = {
        meta,
        value,
        ratio,
      }
    }
  }

  return best
}

// ---- 1. Right now ------------------------------------------------------------

function RightNow() {
  const { location } = useSelectedLocation()
  const { status, data } = useAirQualityData()

  const place = data?.location.name ?? location?.name

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          What you’re breathing right now
          {place ? ` in ${place}` : ''}
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-6 pt-3 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          {status === 'loading' && !data && (
            <>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </>
          )}

          {!data && status === 'error' && (
            <p className="text-muted-foreground">
              Live readings are unavailable right now. The guide below
              still applies.
            </p>
          )}

          {data &&
            (() => {
              const cat = getAqiCategory(data.aqi)
              const main = mainPollutant(data)
              const lesson =
                main && POLLUTANT_LESSONS[main.meta.key]

              return (
                <>
                  <p className="flex items-center gap-2 text-base">
                    <span
                      aria-hidden
                      className={cn(
                        'size-3 rounded-full',
                        AQI_BG[cat.key],
                      )}
                    />

                    <span>
                      AQI{' '}
                      <strong className="font-semibold">
                        {data.aqi}
                      </strong>{' '}
                      · {cat.label}
                    </span>
                  </p>

                  <p className="text-muted-foreground">
                    {AQI_MEANING[cat.key]}
                  </p>

                  {main && lesson && (
                    <p>
                      The main pollutant right now is{' '}
                      <strong className="font-semibold">
                        {main.meta.label}
                      </strong>{' '}
                      ({lesson.name.toLowerCase()}) at{' '}
                      {main.value} {main.meta.unit}, which is{' '}
                      <span className="font-medium">
                        {getPollutantLevel(
                          main.meta,
                          main.value,
                        ).label.toLowerCase()}
                      </span>
                      .{' '}
                      <span className="text-muted-foreground">
                        {lesson.body}
                      </span>
                    </p>
                  )}
                </>
              )
            })()}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Clean air is mostly
          </p>

          <div
            aria-hidden
            className="flex h-3 overflow-hidden rounded-full bg-muted"
          >
            {CLEAN_AIR.map((g) => (
              <span
                key={g.label}
                className={g.bar}
                style={{
                  width: `${Math.max(g.share, 2)}%`,
                }}
              />
            ))}
          </div>

          <ul className="mt-3 space-y-1 text-sm">
            {CLEAN_AIR.map((g) => (
              <li
                key={g.label}
                className="flex items-center gap-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2.5 rounded-full',
                    g.bar,
                  )}
                />

                <span className="flex-1">
                  {g.label}
                </span>

                <span className="text-muted-foreground">
                  {g.share === 1
                    ? 'about 1%'
                    : `about ${g.share}%`}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-muted-foreground">
            Pollutants are only a tiny fraction of the air,
            measured in millionths of a gram per cubic metre.
            That is enough to harm health, because we breathe
            about 10,000 litres of air a day.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- 2. Pollutants ------------------------------------------------------------

function PollutantGuide() {
  const { data } = useAirQualityData()

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {POLLUTANTS.map((meta) => {
        const lesson = POLLUTANT_LESSONS[meta.key]
        const value = data?.pollutants[meta.key]

        const level =
          value !== undefined
            ? getPollutantLevel(meta, value)
            : null

        return (
          <Card key={meta.key}>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold">
                    {meta.label}
                  </h3>

                  <p className="text-xs text-muted-foreground">
                    {lesson.name}
                  </p>
                </div>

                {level && value !== undefined && (
                  <p className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
                    <span
                      aria-hidden
                      className={cn(
                        'size-2 rounded-full',
                        AQI_BG[level.key],
                      )}
                    />

                    <span className="font-medium">
                      {value} {meta.unit}
                    </span>

                    <span className="text-muted-foreground">
                      {level.label}
                    </span>
                  </p>
                )}
              </div>

              <p>{lesson.what}</p>

              <dl className="space-y-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Comes from
                  </dt>

                  <dd>{lesson.from}</dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    What it does to you
                  </dt>

                  <dd>{lesson.body}</dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    What helps
                  </dt>

                  <dd>{lesson.tip}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ---- 3. Sources ---------------------------------------------------------------

function Sources() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SOURCES.map(
        ({ icon: Icon, title, text, makes }) => (
          <Card key={title}>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground"
                >
                  <Icon className="size-4" />
                </span>

                <h3 className="font-semibold">
                  {title}
                </h3>
              </div>

              <p>{text}</p>

              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Releases:
                </span>{' '}
                {makes}
              </p>
            </CardContent>
          </Card>
        ),
      )}
    </div>
  )
}

// ---- 4. AQI scale -------------------------------------------------------------

function AqiScale() {
  const { data } = useAirQualityData()

  const current = data
    ? getAqiCategory(data.aqi).key
    : null

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {AQI_CATEGORIES.map((c) => (
            <li
              key={c.key}
              aria-current={
                c.key === current || undefined
              }
              className={cn(
                'flex items-start gap-3 px-5 py-3.5 text-sm',
                c.key === current && 'bg-accent/60',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'mt-1 size-3 shrink-0 rounded-full',
                  AQI_BG[c.key],
                )}
              />

              <span className="w-28 shrink-0 font-medium">
                {c.label}
              </span>

              <span className="w-20 shrink-0 text-muted-foreground">
                {c.max === Infinity
                  ? `${c.min}+`
                  : `${c.min}–${c.max}`}
              </span>

              <span className="min-w-0 flex-1">
                {AQI_MEANING[c.key]}

                {c.key === current && (
                  <span className="ml-2 font-medium text-primary">
                    You are here
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// ---- 5. FAQ -------------------------------------------------------------------

function Faq() {
  return (
    <Card>
      <CardContent className="divide-y px-5 py-1">
        {FAQ.map(({ q, a }) => (
          <details
            key={q}
            className="group py-3.5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              {q}

              <span
                aria-hidden
                className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>

            <p className="mt-2 text-sm text-muted-foreground">
              {a}
            </p>
          </details>
        ))}
      </CardContent>
    </Card>
  )
}

export default function LearnPage() {
  return (
    <>
      <PageHeader
        title="Learn"
        description="Understand what you’re breathing."
      />

      <RightNow />

      <SectionTitle
        title="The six pollutants we measure"
        subtitle="What each one is, where it comes from and what it does. Your current reading is shown on each card."
      />

      <PollutantGuide />

      <SectionTitle
        title="Where pollution comes from"
        subtitle="Most urban air pollution has a handful of everyday sources."
      />

      <Sources />

      <SectionTitle
        title="How to read the AQI"
        subtitle="One number, five levels."
      />

      <AqiScale />

      <SectionTitle title="Common questions" />

      <Faq />

      <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground">
        <Wind
          aria-hidden
          className="mt-0.5 size-3.5 shrink-0"
        />

        General information, not medical advice. For what to
        do at today’s AQI, see the Health and safety section
        on the Overview page.
      </p>
    </>
  )
}