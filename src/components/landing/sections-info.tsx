import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { BookOpen, Building2, Bell, FlaskConical, HeartPulse, Map as MapIcon, Route, Timer, TrendingUp } from 'lucide-react'
import { INDIA_LOCATIONS, STATES, UNION_TERRITORIES } from '@/data/indiaLocations'
import { MAP_POLL_MS } from '@/hooks/useNationalAqi'
import { AQI_BG, AQI_CATEGORIES, getAqiCategory } from '@/lib/aqi'
import { POLLUTANTS } from '@/lib/pollutants'
import { cn } from '@/lib/utils'
import { useLanding } from './context'
import { Counter, Eyebrow, Reveal, ScrollWords, SpotlightCard, Stagger, StaggerItem, TextReveal, Tooltip } from './motion-kit'

/* ---------------------------------------------------------------- numbers */

export function Stats() {
  const items = [
    { icon: Building2, to: INDIA_LOCATIONS.length, suffix: '', label: 'Cities monitored', tip: 'Major cities in every state and union territory' },
    { icon: MapIcon, to: STATES.length + UNION_TERRITORIES.length, suffix: '', label: 'States & UTs covered', tip: `${STATES.length} states and ${UNION_TERRITORIES.length} union territories` },
    { icon: FlaskConical, to: POLLUTANTS.length, suffix: '', label: 'Pollutants explained', tip: 'PM2.5, PM10, NO₂, SO₂, CO and O₃' },
    { icon: Timer, to: MAP_POLL_MS / 1000, suffix: 's', label: 'Between map refreshes', tip: 'The live map asks for new readings about once a minute' },
  ]
  return (
    <section aria-label="Aire in numbers" className="px-4 py-14 sm:px-6">
      <Stagger className="mx-auto grid max-w-6xl grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {items.map(({ icon: Icon, to, suffix, label, tip }) => (
          <StaggerItem key={label}>
            <div className="lp-neu p-5 text-center sm:p-7">
              <span aria-hidden className="lp-neu-in mx-auto mb-4 grid size-12 place-items-center rounded-2xl text-primary">
                <Icon className="size-5" />
              </span>
              <p className="lp-display text-4xl font-semibold tabular-nums sm:text-5xl">
                <Counter to={to} suffix={suffix} />
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <Tooltip label={tip}>
                  <span tabIndex={0} className="cursor-help rounded underline decoration-dotted underline-offset-4">
                    {label}
                  </span>
                </Tooltip>
              </p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}

/* ---------------------------------------------------------------- about */

function Distribution() {
  const { cities, status } = useLanding()
  const reduce = useReducedMotion()
  const rows = useMemo(
    () => AQI_CATEGORIES.map((c) => ({ cat: c, count: cities.filter((x) => getAqiCategory(x.aqi).key === c.key).length })),
    [cities],
  )
  const ranked = useMemo(() => [...cities].sort((a, b) => b.aqi - a.aqi), [cities])
  const lists = [
    { title: 'Most polluted right now', items: ranked.slice(0, 3) },
    { title: 'Cleanest right now', items: ranked.slice(-3).reverse() },
  ]

  return (
    <div className="space-y-4">
      <SpotlightCard className="lp-glass rounded-3xl p-6">
        <h3 className="lp-display text-xl font-semibold">Air quality across India, right now</h3>
        <p className="mt-1 text-sm text-muted-foreground">How many monitored cities sit in each AQI level.</p>
        <ul className="mt-5 space-y-3.5">
          {status !== 'success' && [0, 1, 2, 3, 4].map((i) => <li key={i} className="lp-skeleton h-6" />)}
          {status === 'success' &&
            rows.map(({ cat, count }) => {
              const pct = cities.length ? (count / cities.length) * 100 : 0
              return (
                <li key={cat.key} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                  <span className="truncate font-medium">{cat.label}</span>
                  <span className="lp-neu-in h-3 overflow-hidden rounded-full" role="img" aria-label={`${count} of ${cities.length} cities`}>
                    <motion.span
                      className={cn('block h-full origin-left rounded-full', AQI_BG[cat.key])}
                      style={{ width: `${pct}%` }}
                      initial={reduce ? false : { scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{count}</span>
                </li>
              )
            })}
        </ul>
      </SpotlightCard>

      <div className="grid gap-4 sm:grid-cols-2">
        {lists.map((l) => (
          <SpotlightCard key={l.title} className="lp-glass rounded-3xl p-5">
            <h3 className="text-sm font-semibold text-muted-foreground">{l.title}</h3>
            <ul className="mt-3 space-y-2">
              {status !== 'success' && [0, 1, 2].map((i) => <li key={i} className="lp-skeleton h-9" />)}
              {l.items.map((c) => (
                <li key={c.location.id} className="flex items-center gap-3 text-sm">
                  <span aria-hidden className={cn('size-2.5 rounded-full', AQI_BG[getAqiCategory(c.aqi).key])} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.location.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.location.region}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{c.aqi}</span>
                </li>
              ))}
            </ul>
          </SpotlightCard>
        ))}
      </div>
    </div>
  )
}

export function About() {
  return (
    <section id="about" aria-labelledby="about-title" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <Reveal>
              <Eyebrow>About Aire</Eyebrow>
            </Reveal>
            <h2 id="about-title" className="lp-display text-balance text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
              <TextReveal text="A clear picture of the air, for everyone." accent={['clear']} />
            </h2>
            <Reveal delay={0.25}>
              <p className="mt-6 max-w-md text-muted-foreground">
                Aire is an air quality dashboard for India. It reads like a weather app: open it, see how the air is, and know what to do next.
              </p>
            </Reveal>
          </div>
        </div>
        <div className="space-y-12 lg:col-span-7">
          <ScrollWords
            className="lp-display text-2xl font-medium leading-snug sm:text-3xl"
            text="Air quality in India changes by the hour and by the street. Aire brings readings from cities in every state and union territory into one place, paints them on a live map, explains what each pollutant does to your lungs, and tells you what to do about it, from wearing a mask to skipping the morning run."
          />
          <Distribution />
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- features (bento) */

/** The monitored cities drawn as dots at their real positions, so the shape of India appears. */
function DotMap() {
  const { cities } = useLanding()
  const reduce = useReducedMotion()
  const byId = useMemo(() => new Map(cities.map((c) => [c.location.id, c.aqi])), [cities])
  return (
    <div aria-hidden className="relative mx-auto aspect-[27/31] w-full max-w-[19rem]">
      {INDIA_LOCATIONS.map((l, i) => {
        const aqi = byId.get(l.id)
        return (
          <span
            key={l.id}
            className={cn('absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full', aqi === undefined ? 'bg-primary/40' : AQI_BG[getAqiCategory(aqi).key], !reduce && 'lp-glow-pulse')}
            style={{
              left: `${((l.longitude - 68) / 29.5) * 100}%`,
              top: `${((37.5 - l.latitude) / 31.5) * 100}%`,
              animationDelay: `${(i % 12) * 0.25}s`,
            }}
          />
        )
      })}
    </div>
  )
}

function Sparkline() {
  const reduce = useReducedMotion()
  const draw = { initial: reduce ? false : { pathLength: 0 }, whileInView: { pathLength: 1 }, viewport: { once: true }, transition: { duration: 1.6, ease: 'easeInOut' as const } }
  return (
    <svg viewBox="0 0 220 90" className="w-full text-primary" aria-hidden>
      <path d="M130 40 C150 30 170 50 215 28 L215 62 C170 78 150 56 130 62 Z" className="fill-ring/15" />
      <motion.path d="M5 62 C25 38 45 74 70 52 S110 22 130 40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" {...draw} />
      <motion.path d="M130 40 C150 30 170 50 215 28" fill="none" className="stroke-ring" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 7" {...draw} />
      <line x1="130" y1="8" x2="130" y2="84" className="stroke-muted-foreground/50" strokeDasharray="2 3" />
    </svg>
  )
}

function Soon() {
  return <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">Coming soon</span>
}

export function Features() {
  const card = 'lp-glass lp-lift h-full rounded-3xl p-6 sm:p-7'
  const icon = 'lp-neu-in grid size-11 place-items-center rounded-2xl text-primary'
  return (
    <section id="features" aria-labelledby="features-title" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div aria-hidden className="lp-lines pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <Eyebrow>Features</Eyebrow>
          </Reveal>
          <h2 id="features-title" className="lp-display text-balance text-4xl font-semibold leading-[1.05] sm:text-5xl">
            <TextReveal text="Everything you need to breathe a little easier." accent={['breathe']} />
          </h2>
        </div>

        <Stagger className="mt-14 grid gap-4 md:auto-rows-[minmax(15rem,auto)] md:grid-cols-6">
          <StaggerItem className="md:col-span-4 md:row-span-2">
            <SpotlightCard className={cn(card, 'lp-border flex flex-col')}>
              <span className={icon}><MapIcon aria-hidden className="size-5" /></span>
              <h3 className="lp-display mt-5 text-2xl font-semibold">A live heat map of India</h3>
              <p className="mt-2 max-w-md text-muted-foreground">
                Every monitored city is coloured by its AQI on an interactive map. Zoom in to see the numbers, click a city to open its full dashboard.
              </p>
              <div className="mt-6 flex flex-1 items-center">
                <DotMap />
              </div>
            </SpotlightCard>
          </StaggerItem>

          <StaggerItem className="md:col-span-2">
            <SpotlightCard className={card}>
              <span className={icon}><TrendingUp aria-hidden className="size-5" /></span>
              <h3 className="lp-display mt-5 text-xl font-semibold">Forecasts</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">See where the next hours are heading, with a shaded range of uncertainty.</p>
              <div className="mt-4"><Sparkline /></div>
            </SpotlightCard>
          </StaggerItem>

          <StaggerItem className="md:col-span-2">
            <SpotlightCard className={card}>
              <span className={icon}><FlaskConical aria-hidden className="size-5" /></span>
              <h3 className="lp-display mt-5 text-xl font-semibold">Pollutant breakdown</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">Each pollutant on its own scale, so you can see what is driving the number.</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {POLLUTANTS.map((p) => (
                  <li key={p.key} className="lp-neu-in rounded-full px-3 py-1 text-xs font-semibold">{p.label}</li>
                ))}
              </ul>
            </SpotlightCard>
          </StaggerItem>

          <StaggerItem className="md:col-span-3">
            <SpotlightCard className={card}>
              <span className={icon}><HeartPulse aria-hidden className="size-5" /></span>
              <h3 className="lp-display mt-5 text-xl font-semibold">Health guidance that matches the air</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">Measures to take now, health problems linked to polluted air, and who is most at risk, tuned to today’s level.</p>
              <div aria-hidden className="mt-5 flex h-2.5 overflow-hidden rounded-full">
                {AQI_CATEGORIES.map((c) => <span key={c.key} className={cn('flex-1', AQI_BG[c.key])} />)}
              </div>
            </SpotlightCard>
          </StaggerItem>

          <StaggerItem className="md:col-span-3">
            <SpotlightCard className={card}>
              <span className={icon}><BookOpen aria-hidden className="size-5" /></span>
              <h3 className="lp-display mt-5 text-xl font-semibold">Learn what you’re breathing</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">What each pollutant is, where it comes from, what it does to your body and what helps, in plain language.</p>
            </SpotlightCard>
          </StaggerItem>

          <StaggerItem className="md:col-span-3">
            <SpotlightCard className={card}>
              <div className="flex items-start justify-between gap-3">
                <span className={icon}><Route aria-hidden className="size-5" /></span>
                <Soon />
              </div>
              <h3 className="lp-display mt-5 text-xl font-semibold">Cleaner routes</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">Compare time, distance and pollution exposure before you head out.</p>
            </SpotlightCard>
          </StaggerItem>

          <StaggerItem className="md:col-span-3">
            <SpotlightCard className={card}>
              <div className="flex items-start justify-between gap-3">
                <span className={icon}><Bell aria-hidden className="size-5" /></span>
                <Soon />
              </div>
              <h3 className="lp-display mt-5 text-xl font-semibold">Smart alerts</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">Get notified when the air in your city changes.</p>
            </SpotlightCard>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  )
}
