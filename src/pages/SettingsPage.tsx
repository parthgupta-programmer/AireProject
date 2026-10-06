import { Monitor, Moon, Sun } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { useTheme, type Theme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  return (
    <>
      <PageHeader title="Settings" />
      <Card className="max-w-xl">
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold">Appearance</p>
            <p className="text-sm text-muted-foreground">Choose a theme.</p>
          </div>
          <div role="radiogroup" aria-label="Theme" className="app-glass flex rounded-full p-0.5">
            {options.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors',
                  theme === value ? 'bg-accent font-semibold text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
                <span className="sr-only sm:hidden">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
