import { Outlet, useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { MobileNav } from './MobileNav'

export function AppLayout() {
  const { pathname } = useLocation()
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip">
      {/* same backdrop as the landing page: soft colour mesh with a little film grain */}
      <div aria-hidden className="app-mesh" />
      <div aria-hidden className="app-grain" />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-8 outline-none sm:px-6 lg:pb-14 lg:pt-10">
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
