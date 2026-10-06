import { LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'

import { useAuth } from '@/context/AuthContext'
import { primaryNav, settingsItem } from '@/config/navigation'
import { Button, buttonVariants } from '@/components/ui/button'

import { cn } from '@/lib/utils'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

export function Navbar() {
  const { user, logOut } = useAuth()

  return (
    // floating glass pill, like the landing page's navigation once you scroll
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4">
      <div className="app-glass mx-auto flex h-14 w-full max-w-6xl items-center gap-4 rounded-full px-4 sm:px-5">
        <Logo />

        <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 lg:flex">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative isolate rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                  isActive && 'text-accent-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="app-nav-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-accent"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <NavLink
            to={settingsItem.to}
            aria-label="Settings"
            className={({ isActive }) =>
              cn(
                buttonVariants({ variant: 'ghost', size: 'icon' }),
                'hidden lg:inline-flex',
                isActive && 'bg-accent text-accent-foreground',
              )
            }
          >
            <settingsItem.icon className="size-[18px]" />
          </NavLink>

          <ThemeToggle />

          {user && (
            <>
              <span
                className="ml-2 hidden max-w-[10rem] truncate text-sm font-medium text-muted-foreground md:inline"
                title={user.email}
              >
                {user.name}
              </span>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Log out"
                title="Log out"
                onClick={logOut}
              >
                <LogOut className="size-[18px]" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
