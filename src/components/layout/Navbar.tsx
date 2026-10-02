import { LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'
import { primaryNav, settingsItem } from '@/config/navigation'
import { Button, buttonVariants } from '@/components/ui/button'

import { cn } from '@/lib/utils'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

export function Navbar() {
  const { user, logOut } = useAuth()

  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 lg:flex">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
                  isActive && 'bg-accent font-medium text-accent-foreground',
                )
              }
            >
              {item.label}
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
                className="ml-2 hidden max-w-[10rem] truncate text-sm text-muted-foreground md:inline"
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