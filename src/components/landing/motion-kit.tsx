import { useEffect, useId, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { cn } from '@/lib/utils'
import { useFinePointer, useLanding } from './context'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const VIEWPORT = { once: true, margin: '0px 0px -12% 0px' } as const

/* ---------------------------------------------------------------- reveal on scroll */

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  x?: number
  y?: number
  scale?: number
  blur?: boolean
}

/** Fades, slides, scales and optionally un-blurs its content the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0, x = 0, y = 28, scale = 1, blur = false }: RevealProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={blur ? { opacity: 0, x, y, scale, filter: 'blur(12px)' } : { opacity: 0, x, y, scale }}
      whileInView={blur ? { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' } : { opacity: 1, x: 0, y: 0, scale: 1 }}
      // A leftover filter would stop glass children from blurring what is behind them, so clear it once done.
      onAnimationComplete={() => {
        if (blur && ref.current) ref.current.style.filter = 'none'
      }}
      viewport={VIEWPORT}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }
const itemVariants = { hidden: { opacity: 0, y: 26, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.65, ease: EASE } } }

/** Children wrapped in <StaggerItem> appear one after another. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={containerVariants} initial="hidden" whileInView="show" viewport={VIEWPORT}>
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}

/* ---------------------------------------------------------------- text */

interface TextRevealProps {
  text: string
  className?: string
  delay?: number
  /** Words to paint with the animated gradient. */
  accent?: string[]
  /** Animate on mount instead of when scrolled into view (for the hero). */
  immediate?: boolean
}

/** Each word rises out of a mask, one after another. */
export function TextReveal({ text, className, delay = 0, accent = [], immediate = false }: TextRevealProps) {
  const reduce = useReducedMotion()
  const words = text.split(' ')
  const accentClass = (w: string) => (accent.includes(w.replace(/[^\p{L}\p{N}]/gu, '')) ? 'lp-gradient-text' : '')
  if (reduce)
    return (
      <span className={className}>
        {words.map((w, i) => (
          <span key={i} className={accentClass(w)}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    )
  const trigger = immediate ? { animate: 'show' } : { whileInView: 'show', viewport: VIEWPORT }
  return (
    <motion.span
      className={className}
      initial="hidden"
      {...trigger}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: delay } } }}
    >
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.14em] align-bottom">
          <motion.span
            className={cn('inline-block', accentClass(w))}
            variants={{ hidden: { y: '115%', rotate: 4, filter: 'blur(8px)' }, show: { y: 0, rotate: 0, filter: 'blur(0px)', transition: { duration: 0.85, ease: EASE } } }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </motion.span>
  )
}

function ScrollWord({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.16, 1])
  return (
    <motion.span style={{ opacity }} className="inline-block">
      {word}&nbsp;
    </motion.span>
  )
}

/** A paragraph whose words light up as you scroll through it. */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.55'] })
  const words = text.split(' ')
  if (reduce)
    return (
      <p ref={ref} className={className}>
        {text}
      </p>
    )
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <ScrollWord key={i} word={w} progress={scrollYProgress} range={[i / words.length, Math.min(1, (i + 1) / words.length + 0.04)]} />
      ))}
    </p>
  )
}

/** Number that counts up the first time it is visible. */
export function Counter({ to, suffix = '', className }: { to: number; suffix?: string; className?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -15% 0px' })
  const [value, setValue] = useState(reduce ? to : 0)

  useEffect(() => {
    if (!inView) return
    if (reduce) {
      setValue(to)
      return
    }
    const controls = animate(0, to, { duration: 1.8, ease: 'easeOut', onUpdate: (v) => setValue(Math.round(v)) })
    return () => controls.stop()
  }, [inView, to, reduce])

  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  )
}

/* ---------------------------------------------------------------- interaction */

interface CtaProps {
  to: string
  children: ReactNode
  variant?: 'primary' | 'ghost'
  size?: 'md' | 'lg'
  className?: string
  magnetic?: boolean
}

/** Link-styled button: leans toward the pointer, ripples on click, and navigates with the page exit animation. */
export function CtaButton({ to, children, variant = 'primary', size = 'md', className, magnetic = true }: CtaProps) {
  const { go } = useLanding()
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const ref = useRef<HTMLAnchorElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 })
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([])
  const lean = magnetic && fine && !reduce

  const onMove = (e: PointerEvent<HTMLAnchorElement>) => {
    if (!lean || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * 0.32)
    y.set((e.clientY - (r.top + r.height / 2)) * 0.32)
  }
  const onLeave = () => {
    x.set(0)
    y.set(0)
  }
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!reduce && ref.current) {
      const r = ref.current.getBoundingClientRect()
      const size = Math.max(r.width, r.height) * 2
      const cx = e.detail === 0 ? r.left + r.width / 2 : e.clientX
      const cy = e.detail === 0 ? r.top + r.height / 2 : e.clientY
      const id = Date.now() + Math.random()
      setRipples((rs) => [...rs, { id, x: cx - r.left - size / 2, y: cy - r.top - size / 2, size }])
      window.setTimeout(() => setRipples((rs) => rs.filter((i) => i.id !== id)), 700)
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    go(to)
  }

  return (
    <motion.a
      ref={ref}
      href={to}
      data-cursor
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
      style={{ x: sx, y: sy }}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      className={cn('lp-btn', variant === 'primary' ? 'lp-btn-primary' : 'lp-btn-ghost', size === 'lg' ? 'h-14 px-8 text-base' : 'h-11 px-6 text-sm', className)}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      {ripples.map((r) => (
        <span key={r.id} aria-hidden className="lp-ripple" style={{ left: r.x, top: r.y, width: r.size, height: r.size }} />
      ))}
    </motion.a>
  )
}

/** Card that tilts toward the pointer in 3D. Children can float above it with translateZ. */
export function TiltCard({ children, className, max = 9 }: { children: ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const ref = useRef<HTMLDivElement>(null)
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 140, damping: 16 })
  const sry = useSpring(ry, { stiffness: 140, damping: 16 })
  const enabled = fine && !reduce

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    ry.set(((e.clientX - r.left) / r.width - 0.5) * max * 2)
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * max * 2)
  }
  const onLeave = () => {
    rx.set(0)
    ry.set(0)
  }

  return (
    <div style={{ perspective: 1100 }} className={className}>
      <motion.div ref={ref} className="relative" onPointerMove={onMove} onPointerLeave={onLeave} style={{ rotateX: srx, rotateY: sry, transformStyle: 'preserve-3d' }}>
        {children}
      </motion.div>
    </div>
  )
}

/** Card with a soft light that follows the pointer. Add your own surface classes. */
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <div onPointerMove={onMove} className={cn('lp-spot', className)}>
      {children}
    </div>
  )
}

/** Small label that appears on hover and keyboard focus. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      <AnimatePresence>
        {open && (
          <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
            <motion.span
              id={id}
              role="tooltip"
              initial={{ opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="block whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-lg"
            >
              {label}
            </motion.span>
          </span>
        )}
      </AnimatePresence>
    </span>
  )
}

/** Small uppercase label above a section heading. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('mb-4 inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.16em] text-primary', className)}>
      <span aria-hidden className="h-px w-8 bg-primary" />
      {children}
    </p>
  )
}
