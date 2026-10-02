import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Ellipsis } from 'lucide-react'
import { mobileTabPaths, navItems } from '@/config/navigation'
import { cn } from '@/lib/utils'

const tabCls =
  'flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground transition-colors'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const tabs = navItems.filter((i) => mobileTabPaths.includes(i.to))
  const more = navItems.filter((i) => !mobileTabPaths.includes(i.to))
  const moreActive = more.some((i) => pathname.startsWith(i.to))

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="lg:hidden">
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <ul id="more-menu" className="fixed inset-x-3 bottom-[4.5rem] z-40 animate-page-in rounded-lg border bg-card p-1.5">
            {more.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm', isActive ? 'bg-accent font-medium text-accent-foreground' : 'text-foreground')
                  }
                >
                  <item.icon className="size-[18px] text-muted-foreground" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </>
      )}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-md">
          {tabs.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => cn(tabCls, isActive && 'font-medium text-primary')}>
                <item.icon className="size-5" aria-hidden />
                {item.short}
              </NavLink>
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              aria-expanded={open}
              aria-controls="more-menu"
              onClick={() => setOpen((o) => !o)}
              className={cn(tabCls, (open || moreActive) && 'font-medium text-primary')}
            >
              <Ellipsis className="size-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}
