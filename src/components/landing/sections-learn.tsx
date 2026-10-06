import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { ChevronLeft, ChevronRight, FlaskConical, Map as MapIcon, Plus, Radio, ShieldCheck, type LucideIcon } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { INDIA_LOCATIONS, STATES, UNION_TERRITORIES } from '@/data/indiaLocations'
import { AQI_BG, AQI_CATEGORIES, getAqiCategory } from '@/lib/aqi'
import { AQI_ORDER, MEASURES } from '@/lib/healthInfo'
import { AQI_MEANING, FAQ, POLLUTANT_LESSONS, SOURCES, type PollutionSource } from '@/lib/learnContent'
import { POLLUTANTS } from '@/lib/pollutants'
import { cn } from '@/lib/utils'
import { useMediaQuery } from './context'
import { Eyebrow, Reveal, Stagger, StaggerItem, TextReveal } from './motion-kit'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

/** Shown in the FAQ. Edit this sentence when the app is connected to a real data source. */
export const DATA_NOTE =
  'This build shows simulated readings, so the whole experience can be explored end to end. Once Aire is connected to a live source such as the CPCB or OpenAQ, the same map, forecasts and guidance will run on real measurements.'

/* ---------------------------------------------------------------- how it works */

interface Step {
  n: string
  icon: LucideIcon
  title: string
  text: string
}

const STEPS: Step[] = [
  { n: '01', icon: Radio, title: 'Measure', text: `Readings for ${INDIA_LOCATIONS.length} cities across all ${STATES.length + UNION_TERRITORIES.length} states and union territories are gathered and refreshed about once a minute.` },
  { n: '02', icon: MapIcon, title: 'Map', text: 'Each city is coloured by its AQI on an interactive map, so you can see at a glance where the air is clean and where it is not.' },
  { n: '03', icon: FlaskConical, title: 'Understand', text: 'Every pollutant is broken out on its own scale, with plain-language notes on where it comes from and what it does to your body.' },
  { n: '04', icon: ShieldCheck, title: 'Act', text: 'Get measures matched to the current level, from opening the windows to wearing an N95 mask, and see where the next hours are heading.' },
]

function StepCard({ step, className }: { step: Step; className?: string }) {
  return (
    <div className={cn('lp-glass relative w-full max-w-2xl rounded-[2rem] p-7 sm:p-10', className)}>
      <div className="flex items-center justify-between">
        <span className="lp-neu-in grid size-14 place-items-center rounded-2xl text-primary">
          <step.icon aria-hidden className="size-6" />
        </span>
        <span className="lp-display text-6xl font-semibold text-foreground/10 sm:text-7xl" aria-hidden>
          {step.n}
        </span>
      </div>
      <h3 className="lp-display mt-6 text-3xl font-semibold sm:text-4xl">{step.title}</h3>
      <p className="mt-3 text-base text-muted-foreground sm:text-lg">{step.text}</p>
    </div>
  )
}

/** A glowing 3D orb with orbiting rings. It spins and swells as the page scrolls. */
function Orb({ rotateY, scale }: { rotateY: MotionValue<number>; scale: MotionValue<number> }) {
  return (
    <div aria-hidden className="lp-scene pointer-events-none absolute right-[5%] top-1/2 -translate-y-1/2 opacity-60">
      <motion.div style={{ rotateY, rotateX: 18, scale }} className="lp-orb size-[24rem]">
        <div className="lp-orb-core" />
        <div className="lp-orb-ring" style={{ transform: 'rotateX(75deg)' }} />
        <div className="lp-orb-ring" style={{ transform: 'rotateY(75deg)' }} />
        <div className="lp-orb-ring" style={{ transform: 'rotateX(55deg) rotateY(40deg)' }} />
      </motion.div>
    </div>
  )
}

function Pinned() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const x = useTransform(scrollYProgress, [0, 1], ['0%', `-${((STEPS.length - 1) / STEPS.length) * 100}%`])
  const rotateY = useTransform(scrollYProgress, [0, 1], [0, 360])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1.2, 0.9])
  const bar = useSpring(scrollYProgress, { stiffness: 120, damping: 28 })

  return (
    <div ref={ref} style={{ height: `${STEPS.length * 100}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <Orb rotateY={rotateY} scale={scale} />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-8">
          <Eyebrow>How it works</Eyebrow>
          <h2 id="how-title" className="lp-display text-4xl font-semibold sm:text-5xl">From a reading to a decision</h2>
        </div>
        <motion.div style={{ x, width: `${STEPS.length * 100}%` }} className="relative flex will-change-transform">
          {STEPS.map((s) => (
            <div key={s.n} style={{ width: `${100 / STEPS.length}%` }} className="flex items-center px-6 lg:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]">
              <StepCard step={s} />
            </div>
          ))}
        </motion.div>
        <div aria-hidden className="mx-auto mt-10 h-1.5 w-full max-w-6xl px-6">
          <div className="lp-neu-in h-full overflow-hidden rounded-full">
            <motion.div style={{ scaleX: bar }} className="h-full origin-left rounded-full bg-gradient-to-r from-primary to-aqi-moderate" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function HowItWorks() {
  const reduce = useReducedMotion()
  const wide = useMediaQuery('(min-width: 1024px)')
  const pinned = wide && !reduce
  return (
    <section id="how" aria-labelledby="how-title" className="relative">
      {pinned ? (
        <Pinned />
      ) : (
        <div className="px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <Eyebrow>How it works</Eyebrow>
            </Reveal>
            <h2 id="how-title" className="lp-display text-4xl font-semibold sm:text-5xl">
              <TextReveal text="From a reading to a decision" />
            </h2>
            <Stagger className="mt-10 grid gap-5 md:grid-cols-2">
              {STEPS.map((s) => (
                <StaggerItem key={s.n}>
                  <StepCard step={s} className="max-w-none" />
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      )}
    </section>
  )
}

/* ---------------------------------------------------------------- explore: pollutant tabs */

function PollutantTabs() {
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const meta = POLLUTANTS[active]
  const lesson = POLLUTANT_LESSONS[meta.key]

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (active + dir + POLLUTANTS.length) % POLLUTANTS.length
    setActive(next)
    refs.current[next]?.focus()
  }

  return (
    <div className="lp-glass rounded-3xl p-6 sm:p-8">
      <h3 className="lp-display text-2xl font-semibold">What’s in the air?</h3>
      <p className="mt-1 text-sm text-muted-foreground">Pick a pollutant to see what it is and what it does.</p>
      <div role="tablist" aria-label="Pollutants" onKeyDown={onKeyDown} className="lp-neu-in mt-5 flex flex-wrap gap-1 rounded-2xl p-1.5">
        {POLLUTANTS.map((p, i) => (
          <button
            key={p.key}
            ref={(el) => { refs.current[i] = el }}
            role="tab"
            id={`tab-${p.key}`}
            aria-selected={i === active}
            aria-controls="pollutant-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            data-cursor
            className={cn('relative isolate rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors', i === active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {i === active && <motion.span layoutId="lp-tab-pill" className="absolute inset-0 -z-10 rounded-xl bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            {p.label}
          </button>
        ))}
      </div>
      <div id="pollutant-panel" role="tabpanel" aria-labelledby={`tab-${meta.key}`} tabIndex={0} className="mt-6 min-h-[17rem] rounded-xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={meta.key} initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: EASE }}>
            <h4 className="text-lg font-semibold">{lesson.name}</h4>
            <p className="mt-2 text-muted-foreground">{lesson.what}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="font-semibold">Comes from</dt><dd className="text-muted-foreground">{lesson.from}</dd></div>
              <div><dt className="font-semibold">What it does</dt><dd className="text-muted-foreground">{lesson.body}</dd></div>
              <div><dt className="font-semibold">What helps</dt><dd className="text-muted-foreground">{lesson.tip}</dd></div>
            </dl>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- explore: AQI slider */

function AqiPlayground() {
  const [aqi, setAqi] = useState(120)
  const [sensitive, setSensitive] = useState(false)
  const cat = getAqiCategory(aqi)
  const adviceKey = AQI_ORDER[Math.min(AQI_ORDER.indexOf(cat.key) + (sensitive ? 1 : 0), AQI_ORDER.length - 1)]

  return (
    <div className="lp-glass rounded-3xl p-6 sm:p-8">
      <h3 className="lp-display text-2xl font-semibold">Try the AQI scale</h3>
      <p className="mt-1 text-sm text-muted-foreground">Drag the slider to see what each level means for you.</p>

      <div className="mt-6 flex items-end justify-between gap-4">
        <p className="lp-display text-6xl font-semibold tabular-nums leading-none">
          <AnimatedNumber value={aqi} />
        </p>
        <p className="flex items-center gap-2 rounded-full bg-foreground/[0.06] px-3.5 py-1.5 text-sm font-semibold">
          <span aria-hidden className={cn('size-2.5 rounded-full', AQI_BG[cat.key])} />
          {cat.label}
        </p>
      </div>

      <div className="mt-6">
        <label htmlFor="aqi-range" className="sr-only">Choose an AQI value</label>
        <input id="aqi-range" type="range" min={0} max={400} step={1} value={aqi} onChange={(e) => setAqi(Number(e.target.value))} aria-valuetext={`${aqi}, ${cat.label}`} className="lp-range" />
        <div aria-hidden className="mt-2 flex justify-between text-xs text-muted-foreground"><span>0</span><span>100</span><span>200</span><span>300</span><span>400+</span></div>
      </div>

      <div className="lp-neu-in mt-5 h-2.5 overflow-hidden rounded-full" role="progressbar" aria-label="Pollution level" aria-valuemin={0} aria-valuemax={400} aria-valuenow={aqi}>
        <motion.div className={cn('h-full origin-left rounded-full', AQI_BG[cat.key])} animate={{ scaleX: Math.max(aqi, 4) / 400 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={sensitive}
        onClick={() => setSensitive((s) => !s)}
        data-cursor
        className="mt-6 flex w-full items-center justify-between gap-4 rounded-2xl px-1 text-left text-sm"
      >
        <span>
          <span className="block font-semibold">Sensitive-group view</span>
          <span className="block text-muted-foreground">Children, older adults and people with asthma or heart disease feel effects earlier, so this shows guidance for one level up.</span>
        </span>
        <span className={cn('lp-neu-in relative h-8 w-14 shrink-0 rounded-full transition-colors', sensitive && 'bg-primary/25')}>
          <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={cn('absolute top-1 size-6 rounded-full bg-primary shadow-md', sensitive ? 'right-1' : 'left-1')} />
        </span>
      </button>

      <div className="mt-5 min-h-[10rem]" aria-live="polite">
        <p className="text-sm font-semibold">{AQI_MEANING[cat.key]}</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.ul key={adviceKey} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="mt-3 space-y-2 text-sm text-muted-foreground">
            {MEASURES[adviceKey].slice(0, 3).map((m) => (
              <li key={m} className="flex gap-2.5"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{m}</li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- explore: flip cards */

function FlipCard({ source }: { source: PollutionSource }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div className="lp-flip h-60" data-flipped={flipped}>
      <button type="button" aria-pressed={flipped} onClick={() => setFlipped((f) => !f)} data-cursor className="lp-flip-inner block h-full w-full rounded-3xl text-left">
        <div className="lp-face flex flex-col justify-between rounded-3xl border bg-card p-6 shadow-sm">
          <span className="lp-neu-in grid size-12 place-items-center rounded-2xl text-primary"><source.icon aria-hidden className="size-6" /></span>
          <div>
            <h4 className="lp-display text-xl font-semibold">{source.title}</h4>
            <p className="mt-1 text-xs text-muted-foreground">Tap or hover to flip</p>
          </div>
        </div>
        <div className="lp-face lp-face-back flex flex-col justify-between rounded-3xl bg-primary p-6 text-primary-foreground shadow-lg">
          <p className="text-sm">{source.text}</p>
          <p className="text-xs opacity-90"><span className="font-semibold">Releases:</span> {source.makes}</p>
        </div>
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- explore: carousel */

function Tips() {
  const ref = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [dragging, setDragging] = useState(false)
  const last = AQI_CATEGORIES.length - 1

  const goTo = (i: number) => {
    const el = ref.current
    const card = el?.children[Math.max(0, Math.min(last, i))] as HTMLElement | undefined
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: reduce ? 'auto' : 'smooth' })
  }
  const onScroll = () => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      const el = ref.current
      const first = el?.children[0] as HTMLElement | undefined
      if (el && first) setIndex(Math.max(0, Math.min(last, Math.round(el.scrollLeft / (first.offsetWidth + 16)))))
    })
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1) }
  }
  // mouse drag-to-scroll (touch and trackpad already scroll natively)
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !ref.current) return
    drag.current = { x: e.clientX, left: ref.current.scrollLeft }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current && ref.current) ref.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
  }
  const onUp = () => {
    drag.current = null
    setDragging(false)
  }

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h3 className="lp-display text-2xl font-semibold">What to do at every level</h3>
          <p className="mt-1 text-sm text-muted-foreground">Swipe, drag or use the arrows.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label="Previous level" disabled={index === 0} onClick={() => goTo(index - 1)} data-cursor className="lp-neu grid size-11 place-items-center !rounded-full disabled:opacity-40"><ChevronLeft aria-hidden className="size-5" /></button>
          <button type="button" aria-label="Next level" disabled={index === last} onClick={() => goTo(index + 1)} data-cursor className="lp-neu grid size-11 place-items-center !rounded-full disabled:opacity-40"><ChevronRight aria-hidden className="size-5" /></button>
        </div>
      </div>
      <div
        ref={ref}
        role="region"
        aria-roledescription="carousel"
        aria-label="Guidance by AQI level"
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={cn('lp-hscroll relative -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0', dragging ? 'cursor-grabbing select-none' : 'cursor-grab snap-x snap-mandatory')}
      >
        {AQI_CATEGORIES.map((c) => (
          <article key={c.key} aria-label={c.label} className="lp-glass lp-lift w-[17.5rem] shrink-0 snap-start overflow-hidden rounded-3xl sm:w-80">
            <div className={cn('h-2', AQI_BG[c.key])} />
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AQI {c.max === Infinity ? `${c.min}+` : `${c.min}–${c.max}`}</p>
              <h4 className="lp-display mt-1 text-2xl font-semibold">{c.label}</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                {MEASURES[c.key].slice(0, 3).map((m) => (
                  <li key={m} className="flex gap-2.5"><span aria-hidden className={cn('mt-2 size-1.5 shrink-0 rounded-full', AQI_BG[c.key])} />{m}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-2">
        {AQI_CATEGORIES.map((c, i) => (
          <button key={c.key} type="button" aria-label={`Go to ${c.label}`} aria-current={i === index ? 'true' : undefined} onClick={() => goTo(i)} className="grid size-5 place-items-center">
            <span className={cn('block h-2 rounded-full transition-all duration-300', i === index ? 'w-6 bg-primary' : 'w-2 bg-foreground/25')} />
          </button>
        ))}
      </div>
    </div>
  )
}

export function Explore() {
  return (
    <section id="explore" aria-labelledby="explore-title" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal><Eyebrow>Explore</Eyebrow></Reveal>
          <h2 id="explore-title" className="lp-display text-balance text-4xl font-semibold leading-[1.05] sm:text-5xl">
            <TextReveal text="Learn the air you live in." accent={['air']} />
          </h2>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Reveal x={-30} y={0}><PollutantTabs /></Reveal>
          <Reveal x={30} y={0} delay={0.1}><AqiPlayground /></Reveal>
        </div>

        <div className="mt-24">
          <Reveal>
            <h3 className="lp-display text-2xl font-semibold">Where pollution comes from</h3>
            <p className="mb-6 mt-1 text-sm text-muted-foreground">Most urban air pollution has a handful of everyday sources.</p>
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCES.map((s) => (
              <StaggerItem key={s.title}><FlipCard source={s} /></StaggerItem>
            ))}
          </Stagger>
        </div>

        <div className="mt-24"><Reveal><Tips /></Reveal></div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- FAQ */

const QUESTIONS = [
  { q: 'Which places does Aire cover?', a: `${INDIA_LOCATIONS.length} cities across all ${STATES.length} states and ${UNION_TERRITORIES.length} union territories, from Srinagar to Thiruvananthapuram and from Port Blair to Ahmedabad.` },
  { q: 'Where does the data come from?', a: DATA_NOTE },
  FAQ[0],
  FAQ[3],
  FAQ[4],
  { q: 'Do I need an account?', a: 'Yes. Create an account or log in to open the dashboard. This page is open to everyone.' },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  const reduce = useReducedMotion()
  return (
    <section id="faq" aria-labelledby="faq-title" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-3xl">
        <Reveal><Eyebrow>FAQ</Eyebrow></Reveal>
        <h2 id="faq-title" className="lp-display text-balance text-4xl font-semibold leading-[1.05] sm:text-5xl">
          <TextReveal text="Questions, answered." />
        </h2>
        <Stagger className="mt-10 space-y-3">
          {QUESTIONS.map((item, i) => {
            const isOpen = open === i
            return (
              <StaggerItem key={item.q}>
                <div className={cn('lp-glass overflow-hidden rounded-2xl transition-shadow', isOpen && 'lp-glow')}>
                  <h3>
                    <button
                      type="button"
                      id={`faq-q-${i}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-a-${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                      data-cursor
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold sm:px-6"
                    >
                      {item.q}
                      <motion.span aria-hidden animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: reduce ? 0 : 0.25 }} className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                        <Plus className="size-4" />
                      </motion.span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduce ? 0 : 0.35, ease: EASE }} className="overflow-hidden">
                        <p className="px-5 pb-5 text-muted-foreground sm:px-6">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>
      </div>
    </section>
  )
}
