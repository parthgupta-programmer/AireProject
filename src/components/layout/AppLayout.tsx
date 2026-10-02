import { Outlet, useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { MobileNav } from './MobileNav'

export function AppLayout() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 outline-none sm:px-6 lg:pb-12 lg:pt-8">
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
