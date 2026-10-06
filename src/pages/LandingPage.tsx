import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, MotionConfig, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useNationalAqi } from '@/hooks/useNationalAqi'
import { cn } from '@/lib/utils'
import { BackToTop, CustomCursor, LandingNav, MobileCtaBar, ScrollProgress, SectionDots, ToastHost } from '@/components/landing/chrome'
import { LandingContext, type LandingCtx } from '@/components/landing/context'
import { Hero, Ticker } from '@/components/landing/Hero'
import { About, Features, Stats } from '@/components/landing/sections-info'
import { Explore, Faq, HowItWorks } from '@/components/landing/sections-learn'
import { CtaSection, Footer } from '@/components/landing/sections-end'
import '@/components/landing/landing.css'

// Only downloaded the first time someone opens it (Ctrl / Cmd + K).
const CommandPalette = lazy(() => import('@/components/landing/CommandPalette'))

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&display=swap'

export default function LandingPage() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const { cities, status } = useNationalAqi()
  const [leaving, setLeaving] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([])

  // Display font for headings, loaded only on this page.
  useEffect(() => {
    if (document.getElementById('lp-fonts')) return
    const link = document.createElement('link')
    link.id = 'lp-fonts'
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    const previous = document.title
    document.title = 'Aire — Know exactly what you’re breathing'
    return () => {
      document.title = previous
    }
  }, [])

  // Ctrl / Cmd + K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Fade the page out, then move on, so Log in / Sign up feel like one continuous transition.
  const go = useCallback(
    (to: string) => {
      if (reduce) {
        navigate(to)
        return
      }
      setLeaving(true)
      window.setTimeout(() => navigate(to), 300)
    },
    [navigate, reduce],
  )

  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  const ctx = useMemo<LandingCtx>(
    () => ({ go, toast, openPalette: () => setPaletteOpen(true), cities, status }),
    [go, toast, cities, status],
  )

  return (
    <LandingContext.Provider value={ctx}>
      {/* "user" = transform animations switch off automatically for people who prefer reduced motion */}
      <MotionConfig reducedMotion="user">
        <div className={cn('lp-root lp-enter', leaving && 'lp-leaving')}>
          <a href="#main" className="lp-skip">
            Skip to content
          </a>
          <div aria-hidden className="lp-mesh" />
          <div aria-hidden className="lp-grain" />
          <ScrollProgress />
          <LandingNav />
          <SectionDots />

          <main id="main">
            <Hero />
            <Ticker />
            <Stats />
            <About />
            <Features />
            <HowItWorks />
            <Explore />
            <Faq />
            <CtaSection />
          </main>
          <Footer />

          <BackToTop />
          <MobileCtaBar />
          <CustomCursor />
          <ToastHost toasts={toasts} />
          <AnimatePresence>
            {paletteOpen && (
              <Suspense fallback={null}>
                <CommandPalette onClose={() => setPaletteOpen(false)} />
              </Suspense>
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </LandingContext.Provider>
  )
}
