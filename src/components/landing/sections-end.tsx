import { ArrowRight, Share2 } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { INDIA_LOCATIONS } from '@/data/indiaLocations'
import { SECTIONS, useLanding } from './context'
import { CtaButton, Reveal, TextReveal } from './motion-kit'

export function CtaSection() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  // scroll-linked scale and rotation: the panel settles into place as it reaches the middle of the screen
  const scale = useTransform(scrollYProgress, [0, 0.45], [0.88, 1])
  const rotate = useTransform(scrollYProgress, [0, 0.45], [-3, 0])
  const orbit = useTransform(scrollYProgress, [0, 1], [0, 180])

  return (
    <section ref={ref} aria-labelledby="cta-title" className="relative isolate px-4 py-24 sm:px-6 lg:py-32">
      <motion.div
        style={reduce ? undefined : { scale, rotate }}
        className="lp-glass lp-border relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] px-6 py-16 text-center sm:px-14 sm:py-24"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="lp-blob -left-10 top-0 size-80 bg-primary" />
          <div className="lp-blob -right-10 bottom-0 size-80 bg-aqi-moderate [animation-delay:-8s]" />
        </div>
        <motion.svg aria-hidden viewBox="0 0 100 100" style={reduce ? undefined : { rotate: orbit }} className="pointer-events-none absolute -right-16 -top-16 size-64 text-primary/25">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="6 8" />
          <circle cx="50" cy="6" r="3.5" fill="currentColor" />
        </motion.svg>
        <h2 id="cta-title" className="lp-display mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.05] sm:text-6xl">
          <TextReveal text="Breathe a little smarter." accent={['smarter']} />
        </h2>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Create an account to open your live dashboard, with {INDIA_LOCATIONS.length} cities, an interactive heat map, forecasts and health guidance.
          </p>
        </Reveal>
        <Reveal delay={0.35}>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <CtaButton to="/signup" size="lg">
              Create free account <ArrowRight aria-hidden className="size-5" />
            </CtaButton>
            <CtaButton to="/login" variant="ghost" size="lg">
              Log in
            </CtaButton>
          </div>
        </Reveal>
      </motion.div>
    </section>
  )
}

export function Footer() {
  const { toast, go } = useLanding()
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      toast('Link copied')
    } catch {
      toast('Could not copy the link')
    }
  }
  return (
    <footer className="border-t px-4 pb-28 pt-12 sm:px-6 md:pb-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <a href="#top" className="lp-display flex items-center gap-2 text-xl font-semibold">
            <svg viewBox="0 0 24 24" className="size-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <circle cx="12" cy="12" r="8.5" strokeDasharray="42 12" strokeLinecap="round" />
            </svg>
            Aire
          </a>
          <p className="mt-3 text-sm text-muted-foreground">Air quality, made clear. Live AQI, health guidance and forecasts for cities across India.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="lp-underline w-fit">
              {s.label}
            </a>
          ))}
          <a href="/login" onClick={(e) => { e.preventDefault(); go('/login') }} className="lp-underline w-fit">Log in</a>
          <a href="/signup" onClick={(e) => { e.preventDefault(); go('/signup') }} className="lp-underline w-fit">Sign up</a>
        </nav>
        <div className="flex items-center gap-2">
          <button type="button" onClick={share} data-cursor className="lp-btn lp-btn-ghost h-10 px-4 text-sm">
            <Share2 aria-hidden className="size-4" /> Share
          </button>
          <ThemeToggle />
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl text-xs text-muted-foreground">
        © {new Date().getFullYear()} Aire. General information, not medical advice.
      </p>
    </footer>
  )
}
