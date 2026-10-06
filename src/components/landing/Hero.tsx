import { lazy, Suspense, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { ArrowRight, MapPin, RefreshCw, Wind } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { INDIA_LOCATIONS, STATES, UNION_TERRITORIES } from '@/data/indiaLocations'
import { AQI_BG, AQI_STROKE, getAqiCategory } from '@/lib/aqi'
import { cn } from '@/lib/utils'
import { useFinePointer, useLanding } from './context'
import { CtaButton, Reveal, Stagger, StaggerItem, TextReveal, TiltCard } from './motion-kit'

// Loaded after the page is interactive, so it never delays first paint.
const ParticleField = lazy(() => import('./ParticleField'))

function ParallaxBlob({ nx, ny, strength, className }: { nx: MotionValue<number>; ny: MotionValue<number>; strength: number; className: string }) {
  const x = useTransform(nx, [-1, 1], [-strength, strength])
  const y = useTransform(ny, [-1, 1], [-strength, strength])
  return (
    <motion.div style={{ x, y }} className="absolute">
      <div className={cn('lp-blob', className)} />
    </motion.div>
  )
}

function HeroCard() {
  const { cities, status } = useLanding()
  const ranked = useMemo(() => [...cities].sort((a, b) => b.aqi - a.aqi), [cities])
  const featured = cities.find((c) => c.location.id === 'delhi') ?? ranked[0]
  const average = cities.length ? Math.round(cities.reduce((s, c) => s + c.aqi, 0) / cities.length) : 0
  const cat = featured ? getAqiCategory(featured.aqi) : null
  const rows = ranked.length
    ? [
        { label: 'Most polluted', city: ranked[0].location.name, aqi: ranked[0].aqi },
        { label: 'Cleanest', city: ranked[ranked.length - 1].location.name, aqi: ranked[ranked.length - 1].aqi },
        { label: 'India average', city: `${cities.length} cities`, aqi: average },
      ]
    : []

  return (
    <TiltCard className="mx-auto w-full max-w-sm">
      <div className="lp-glass lp-border relative rounded-[2rem] p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-2 font-medium">
            <span className="relative flex size-2">
              <span className="lp-ping absolute inline-flex size-full rounded-full bg-aqi-good opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-aqi-good" />
            </span>
            Live now
          </span>
          <span className="text-muted-foreground">{featured?.location.name ?? '…'}</span>
        </div>

        <div className="relative mx-auto my-5 size-48">
          <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden>
            <circle cx="100" cy="100" r="82" fill="none" strokeWidth="14" className="stroke-muted" />
            {cat && featured && (
              <motion.circle
                cx="100"
                cy="100"
                r="82"
                fill="none"
                strokeWidth="14"
                strokeLinecap="round"
                className={AQI_STROKE[cat.key]}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: Math.min(featured.aqi, 500) / 500 }}
                transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
              />
            )}
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            {featured && cat ? (
              <>
                <span className="lp-display text-5xl font-semibold tabular-nums">
                  <AnimatedNumber value={featured.aqi} />
                </span>
                <span className="text-sm text-muted-foreground">AQI · {cat.label}</span>
              </>
            ) : (
              <div className="lp-skeleton h-10 w-20" />
            )}
          </div>
        </div>

        <ul className="space-y-2.5">
          {status === 'loading' && [0, 1, 2].map((i) => <li key={i} className="lp-skeleton h-11" />)}
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 rounded-xl bg-foreground/[0.04] px-3 py-2.5 text-sm">
              <span aria-hidden className={cn('size-2.5 rounded-full', AQI_BG[getAqiCategory(r.aqi).key])} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{r.label}</span>
                <span className="block truncate font-medium">{r.city}</span>
              </span>
              <span className="font-semibold tabular-nums">{r.aqi}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* floating chips sit above the card in 3D */}
      <div aria-hidden className="absolute -right-3 -top-4 sm:-right-8" style={{ transform: 'translateZ(70px)' }}>
        <div className="lp-float lp-glass rounded-2xl px-3.5 py-2 text-sm font-semibold shadow-xl">
          PM2.5 <span className="ml-1 text-aqi-poor">●</span>
        </div>
      </div>
      <div aria-hidden className="absolute -bottom-5 -left-3 sm:-left-8" style={{ transform: 'translateZ(90px)' }}>
        <div className="lp-float-slow lp-glass flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-medium shadow-xl">
          <RefreshCw className="size-4 text-primary" /> Updates every minute
        </div>
      </div>
    </TiltCard>
  )
}

export function Hero() {
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const ref = useRef<HTMLElement>(null)
  const [particles, setParticles] = useState(false)

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const blobsY = useTransform(scrollYProgress, [0, 1], [0, 170])
  const textY = useTransform(scrollYProgress, [0, 1], [0, 70])
  const cardY = useTransform(scrollYProgress, [0, 1], [0, -80])
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0.1])

  // pointer position: nx / ny are -1..1 (parallax), px / py are pixels inside the hero (spotlight)
  const nx = useSpring(useMotionValue(0), { stiffness: 60, damping: 20 })
  const ny = useSpring(useMotionValue(0), { stiffness: 60, damping: 20 })
  const px = useMotionValue(-999)
  const py = useMotionValue(-999)
  const spotlight = useMotionTemplate`radial-gradient(520px circle at ${px}px ${py}px, hsl(var(--primary) / 0.17), transparent 65%)`

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (!fine || reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    px.set(e.clientX - r.left)
    py.set(e.clientY - r.top)
    nx.set(((e.clientX - r.left) / r.width - 0.5) * 2)
    ny.set(((e.clientY - r.top) / r.height - 0.5) * 2)
  }

  useEffect(() => {
    if (reduce) return
    const t = window.setTimeout(() => setParticles(true), 700)
    return () => window.clearTimeout(t)
  }, [reduce])

  const chips = [
    { icon: MapPin, text: `${STATES.length + UNION_TERRITORIES.length} states & UTs` },
    { icon: Wind, text: '6 pollutants explained' },
    { icon: RefreshCw, text: 'Live updates' },
  ]

  return (
    <section id="top" ref={ref} onPointerMove={onMove} aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] items-center px-4 pb-20 pt-28 sm:px-6">
      <motion.div aria-hidden style={{ y: blobsY }} className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[8%] top-[10%]"><ParallaxBlob nx={nx} ny={ny} strength={46} className="size-[26rem] bg-primary" /></div>
        <div className="absolute right-[6%] top-[4%]"><ParallaxBlob nx={nx} ny={ny} strength={-60} className="size-[24rem] bg-ring [animation-delay:-6s]" /></div>
        <div className="absolute bottom-[4%] left-[38%]"><ParallaxBlob nx={nx} ny={ny} strength={34} className="size-[22rem] bg-aqi-moderate [animation-delay:-11s]" /></div>
        <div className="absolute bottom-[18%] right-[22%]"><ParallaxBlob nx={nx} ny={ny} strength={-38} className="size-[16rem] bg-aqi-poor [animation-delay:-3s]" /></div>
      </motion.div>
      <div aria-hidden className="lp-dots pointer-events-none absolute inset-0 -z-10" />
      {!reduce && fine && <motion.div aria-hidden style={{ background: spotlight }} className="pointer-events-none absolute inset-0 -z-10" />}
      {particles && (
        <Suspense fallback={null}>
          <ParticleField className="pointer-events-none absolute inset-0 -z-10 size-full" />
        </Suspense>
      )}

      <motion.div style={{ opacity: fade }} className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-12">
        <motion.div style={{ y: textY }} className="lg:col-span-7">
          <Reveal y={14} blur>
            <p className="lp-glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium">
              <span className="relative flex size-2">
                <span className="lp-ping absolute inline-flex size-full rounded-full bg-aqi-good opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-aqi-good" />
              </span>
              Live AQI across {INDIA_LOCATIONS.length} Indian cities
            </p>
          </Reveal>
          <h1 id="hero-title" className="lp-display mt-6 text-balance text-[clamp(2.7rem,7.4vw,5.6rem)] font-semibold leading-[0.98]">
            <TextReveal immediate delay={0.15} accent={['breathing']} text="Know exactly what you’re breathing, anywhere in India." />
          </h1>
          <Reveal delay={0.7} y={20}>
            <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground sm:text-xl">
              Aire turns raw pollution readings into a clear, live picture of the air around you: a heat map of the country, plain-language health guidance and forecasts you can plan your day around.
            </p>
          </Reveal>
          <Reveal delay={0.85} y={20}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <CtaButton to="/signup" size="lg">
                Get started <ArrowRight aria-hidden className="size-5" />
              </CtaButton>
              <CtaButton to="/login" variant="ghost" size="lg">
                Log in
              </CtaButton>
              <a href="#how" data-cursor className="lp-underline px-1 py-1 text-sm font-medium">
                See how it works ↓
              </a>
            </div>
          </Reveal>
          <Stagger className="mt-10 flex flex-wrap gap-2.5">
            {chips.map(({ icon: Icon, text }) => (
              <StaggerItem key={text}>
                <span className="lp-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm text-muted-foreground">
                  <Icon aria-hidden className="size-4 text-primary" />
                  {text}
                </span>
              </StaggerItem>
            ))}
          </Stagger>
        </motion.div>

        <motion.div style={{ y: cardY }} className="lg:col-span-5">
          <Reveal x={50} scale={0.92} delay={0.35} blur>
            <HeroCard />
          </Reveal>
        </motion.div>
      </motion.div>

      <a href="#about" aria-label="Scroll to the next section" data-cursor className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-muted-foreground sm:block">
        <span className="lp-bounce flex h-10 w-6 justify-center rounded-full border-2 border-current pt-2">
          <span className="h-2 w-1 rounded-full bg-current" />
        </span>
      </a>
    </section>
  )
}

/** Endless strip of live city readings. Decorative: the same data is in the map and lists. */
export function Ticker() {
  const { cities } = useLanding()
  const items = useMemo(
    () => [...cities].sort((a, b) => a.location.name.localeCompare(b.location.name)).filter((_, i) => i % 4 === 0),
    [cities],
  )
  if (!items.length) return null
  const row = (prefix: string) =>
    items.map((c) => (
      <li key={`${prefix}-${c.location.id}`} className="lp-glass mx-2 inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-sm">
        <span className={cn('size-2.5 rounded-full', AQI_BG[getAqiCategory(c.aqi).key])} />
        <span className="font-medium">{c.location.name}</span>
        <span className="font-semibold tabular-nums">{c.aqi}</span>
      </li>
    ))
  return (
    <div aria-hidden className="relative overflow-hidden py-6 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
      <ul className="lp-marquee">
        {row('a')}
        {row('b')}
      </ul>
    </div>
  )
}
