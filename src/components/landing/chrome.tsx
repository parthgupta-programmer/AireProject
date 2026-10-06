import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'motion/react'
import { ArrowUp, Command, Menu, Search, X } from 'lucide-react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { cn } from '@/lib/utils'
import { SECTIONS, useActiveSection, useDialog, useFinePointer, useLanding } from './context'
import { Tooltip } from './motion-kit'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const sectionIds = SECTIONS.map((s) => s.id)

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <a href="#top" onClick={onClick} data-cursor className="lp-display flex items-center gap-2 rounded-full text-lg font-semibold">
      <svg viewBox="0 0 24 24" className="size-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <circle cx="12" cy="12" r="8.5" strokeDasharray="42 12" strokeLinecap="round" />
      </svg>
      Aire
    </a>
  )
}

/* ---------------------------------------------------------------- progress + back to top */

export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 })
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-primary via-aqi-moderate to-aqi-poor"
    />
  )
}

export function BackToTop() {
  const { scrollY } = useScroll()
  const reduce = useReducedMotion()
  const [show, setShow] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setShow(y > 700))
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          aria-label="Back to top"
          data-cursor
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          whileHover={{ y: -3 }}
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
          className="lp-glass lp-glow fixed bottom-24 right-4 z-40 grid size-12 place-items-center rounded-full text-primary md:bottom-6 md:right-6"
        >
          <ArrowUp aria-hidden className="size-5" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

/** Sticky Log in / Sign up bar for small screens, shown after the hero. */
export function MobileCtaBar() {
  const { scrollY } = useScroll()
  const { go } = useLanding()
  const [show, setShow] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setShow(y > 520))
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="lp-glass fixed inset-x-3 bottom-3 z-40 flex gap-2 rounded-2xl p-2 md:hidden"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <a href="/login" onClick={(e) => { e.preventDefault(); go('/login') }} className="lp-btn lp-btn-ghost h-11 flex-1 text-sm">
            Log in
          </a>
          <a href="/signup" onClick={(e) => { e.preventDefault(); go('/signup') }} className="lp-btn lp-btn-primary h-11 flex-1 text-sm">
            <span className="relative z-10">Sign up</span>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------------------------------------------------------------- navigation */

export function SectionDots() {
  const active = useActiveSection(sectionIds)
  return (
    <nav aria-label="Page sections" className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 xl:flex">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} aria-label={s.label} aria-current={active === s.id ? 'true' : undefined} data-cursor className="group relative grid size-5 place-items-center">
          <span className={cn('block rounded-full transition-all duration-300', active === s.id ? 'size-3 bg-primary' : 'size-2 bg-foreground/25 group-hover:bg-foreground/60')} />
          <span className="lp-glass pointer-events-none absolute right-7 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {s.label}
          </span>
        </a>
      ))}
    </nav>
  )
}

function FullScreenMenu({ onClose, active }: { onClose: () => void; active: string }) {
  const { go } = useLanding()
  const ref = useDialog(onClose)
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      initial={{ clipPath: 'circle(0% at calc(100% - 2.5rem) 2.5rem)' }}
      animate={{ clipPath: 'circle(150% at calc(100% - 2.5rem) 2.5rem)' }}
      exit={{ clipPath: 'circle(0% at calc(100% - 2.5rem) 2.5rem)' }}
      transition={{ duration: 0.55, ease: EASE }}
      className="fixed inset-0 z-50 flex flex-col bg-background/95 px-6 pb-8 pt-4 backdrop-blur-xl md:hidden"
    >
      <div className="flex h-14 items-center justify-between">
        <Brand onClick={onClose} />
        <button type="button" aria-label="Close menu" onClick={onClose} className="lp-glass grid size-11 place-items-center rounded-full">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } } }}
        className="mt-8 flex flex-1 flex-col justify-center gap-1"
      >
        {SECTIONS.map((s) => (
          <motion.li key={s.id} variants={{ hidden: { opacity: 0, x: -30 }, show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } } }}>
            <a
              href={`#${s.id}`}
              onClick={onClose}
              aria-current={active === s.id ? 'true' : undefined}
              className={cn('lp-display block py-2 text-4xl font-semibold', active === s.id ? 'lp-gradient-text' : 'text-foreground')}
            >
              {s.label}
            </a>
          </motion.li>
        ))}
      </motion.ul>
      <div className="grid gap-3">
        <a href="/signup" onClick={(e) => { e.preventDefault(); onClose(); go('/signup') }} className="lp-btn lp-btn-primary h-14 text-base">
          <span className="relative z-10">Create account</span>
        </a>
        <a href="/login" onClick={(e) => { e.preventDefault(); onClose(); go('/login') }} className="lp-btn lp-btn-ghost h-14 text-base">
          Log in
        </a>
      </div>
    </motion.div>
  )
}

export function LandingNav() {
  const { go, openPalette } = useLanding()
  const { scrollY } = useScroll()
  const active = useActiveSection(sectionIds)
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  // Hide while scrolling down, come back as soon as the user scrolls up.
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0
    setScrolled(y > 24)
    setHidden(y > prev && y > 160)
  })

  return (
    <>
      <motion.header
        animate={{ y: hidden && !menuOpen ? '-120%' : '0%' }}
        transition={{ duration: 0.38, ease: EASE }}
        onFocusCapture={() => setHidden(false)}
        className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4"
      >
        <div className={cn('mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full px-4 transition-[background,box-shadow,border-color] duration-300 sm:px-5', scrolled ? 'lp-glass' : 'border border-transparent')}>
          <Brand />
          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                data-cursor
                aria-current={active === s.id ? 'true' : undefined}
                className={cn('relative isolate rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors', active === s.id ? 'text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {active === s.id && <motion.span layoutId="lp-nav-pill" className="absolute inset-0 -z-10 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                {s.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Tooltip label="Search and shortcuts (Ctrl K)">
              <button type="button" onClick={openPalette} aria-label="Open command palette" data-cursor className="hidden h-9 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex">
                <Search aria-hidden className="size-4" />
                <kbd className="hidden items-center gap-0.5 rounded border border-input px-1.5 text-[11px] lg:inline-flex">
                  <Command aria-hidden className="size-3" />K
                </kbd>
              </button>
            </Tooltip>
            <ThemeToggle />
            <a href="/login" onClick={(e) => { e.preventDefault(); go('/login') }} data-cursor className="lp-underline hidden rounded-full px-3 py-1.5 text-sm font-medium sm:inline-block">
              Log in
            </a>
            <a href="/signup" onClick={(e) => { e.preventDefault(); go('/signup') }} data-cursor className="lp-btn lp-btn-primary hidden h-9 px-4 text-sm sm:inline-flex">
              <span className="relative z-10">Sign up</span>
            </a>
            <button ref={menuButton} type="button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="grid size-9 place-items-center rounded-full hover:bg-accent md:hidden">
              <Menu aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      </motion.header>
      <AnimatePresence>{menuOpen && <FullScreenMenu active={active} onClose={() => setMenuOpen(false)} />}</AnimatePresence>
    </>
  )
}

/* ---------------------------------------------------------------- cursor + toasts */

/** A dot that sticks to the pointer and a ring that trails it and grows over links and buttons. Mouse only. */
export function CustomCursor() {
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const rx = useSpring(x, { stiffness: 260, damping: 26, mass: 0.5 })
  const ry = useSpring(y, { stiffness: 260, damping: 26, mass: 0.5 })
  const ring = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!fine || reduce) return
    const move = (e: PointerEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
      setVisible(true)
      const hot = (e.target as Element | null)?.closest('a, button, input, [role="button"], [data-cursor]')
      if (ring.current) ring.current.dataset.hover = hot ? 'true' : 'false'
    }
    const leave = () => setVisible(false)
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [fine, reduce, x, y])

  if (!fine || reduce) return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[90]" style={{ opacity: visible ? 1 : 0, transition: 'opacity .25s' }}>
      <motion.div ref={ring} data-hover="false" style={{ x: rx, y: ry }} className="lp-cursor-ring absolute left-0 top-0" />
      <motion.div style={{ x, y }} className="lp-cursor-dot absolute left-0 top-0" />
    </div>
  )
}

export function ToastHost({ toasts }: { toasts: { id: number; message: string }[] }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 md:bottom-8">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="lp-glass rounded-full px-5 py-2.5 text-sm font-medium"
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
