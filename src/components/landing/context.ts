import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { CityAqi } from '@/types/airQuality'

export const SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
  { id: 'explore', label: 'Explore' },
  { id: 'faq', label: 'FAQ' },
] as const

export interface LandingCtx {
  /** Navigate with the page exit animation (used by every Log in / Sign up button). */
  go: (to: string) => void
  toast: (message: string) => void
  openPalette: () => void
  /** Live AQI of every monitored city, shared so the page only polls once. */
  cities: CityAqi[]
  status: 'loading' | 'success' | 'error'
}

export const LandingContext = createContext<LandingCtx | null>(null)

export function useLanding() {
  const ctx = useContext(LandingContext)
  if (!ctx) throw new Error('useLanding must be used inside the landing page')
  return ctx
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return matches
}

export const useFinePointer = () => useMediaQuery('(hover: hover) and (pointer: fine)')

/** Which section is currently in the middle of the screen (for nav highlighting). */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>('')
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el)
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])
  return active
}

/**
 * Behaviour shared by the menu and the command palette: focus moves into the dialog, Tab stays inside it,
 * Escape closes it, the page behind does not scroll, and focus goes back to where it was.
 * Mount the dialog only while it is open.
 */
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    const focusable = (): HTMLElement[] =>
      node ? Array.from(node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')) : []
    focusable()[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  return ref
}
