import { useState, type FormEvent } from 'react'
import { Monitor, Moon, Sun, KeyRound, LogOut, User, MapPin, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTheme, type Theme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { changePassword, updateUserPreferences } from '@/services/authService'
import { AuthError } from '@/services/authService'
import { cn } from '@/lib/utils'

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

type Status = { type: 'idle' } | { type: 'loading' } | { type: 'success'; msg: string } | { type: 'error'; msg: string }

function StatusBanner({ status }: { status: Status }) {
  if (status.type === 'idle' || status.type === 'loading') return null
  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm',
        status.type === 'success'
          ? 'bg-emerald-500/10 text-emerald-500'
          : 'bg-aqi-very-poor/10 text-aqi-very-poor',
      )}
    >
      {status.type === 'success' ? (
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="size-4 shrink-0" aria-hidden />
      )}
      {status.msg}
    </div>
  )
}

function ChangePasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<Status>({ type: 'idle' })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next.length < 8) {
      setStatus({ type: 'error', msg: 'New password must be at least 8 characters.' })
      return
    }
    if (next !== confirm) {
      setStatus({ type: 'error', msg: 'New passwords do not match.' })
      return
    }
    setStatus({ type: 'loading' })
    try {
      await changePassword({ current_password: current, new_password: next })
      setCurrent('')
      setNext('')
      setConfirm('')
      setStatus({ type: 'success', msg: 'Password updated successfully.' })
    } catch (err) {
      setStatus({
        type: 'error',
        msg: err instanceof AuthError ? err.message : 'Password change failed. Please try again.',
      })
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-display text-lg font-semibold">Change Password</p>
            <p className="text-sm text-muted-foreground">Your password is hashed with bcrypt on the server.</p>
          </div>
        </div>
        <form onSubmit={submit} noValidate className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Current password</span>
            <Input
              id="settings-current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => { setCurrent(e.target.value); setStatus({ type: 'idle' }) }}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">New password</span>
            <Input
              id="settings-new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => { setNext(e.target.value); setStatus({ type: 'idle' }) }}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Confirm new password</span>
            <Input
              id="settings-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setStatus({ type: 'idle' }) }}
              required
            />
          </label>
          <StatusBanner status={status} />
          <Button
            type="submit"
            size="md"
            className="w-full"
            disabled={status.type === 'loading' || !current || !next || !confirm}
          >
            {status.type === 'loading' && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function PreferredLocationSection() {
  const [locationId, setLocationId] = useState('')
  const [status, setStatus] = useState<Status>({ type: 'idle' })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!locationId.trim()) return
    setStatus({ type: 'loading' })
    try {
      await updateUserPreferences({ preferred_location_id: locationId.trim() })
      setStatus({ type: 'success', msg: 'Preferred location saved.' })
    } catch (err) {
      setStatus({
        type: 'error',
        msg: err instanceof AuthError ? err.message : 'Failed to save location.',
      })
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-display text-lg font-semibold">Preferred Location</p>
            <p className="text-sm text-muted-foreground">Set your default air-quality location.</p>
          </div>
        </div>
        <form onSubmit={save} className="flex gap-2">
          <Input
            id="settings-location-id"
            placeholder="Location ID (e.g. delhi)"
            value={locationId}
            onChange={(e) => { setLocationId(e.target.value); setStatus({ type: 'idle' }) }}
            className="flex-1"
          />
          <Button type="submit" size="md" disabled={status.type === 'loading' || !locationId.trim()}>
            {status.type === 'loading' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Save'}
          </Button>
        </form>
        <StatusBanner status={status} />
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user, logOut } = useAuth()

  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-xl space-y-4">

        {/* Account info */}
        {user && (
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground">
                <User className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{user.name}</p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logOut()}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Log out"
              >
                <LogOut className="size-4" aria-hidden />
                <span className="ml-1.5 hidden sm:inline">Log out</span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Appearance */}
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-lg font-semibold">Appearance</p>
              <p className="text-sm text-muted-foreground">Choose a theme.</p>
            </div>
            <div role="radiogroup" aria-label="Theme" className="app-glass flex rounded-full p-0.5">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors',
                    theme === value
                      ? 'bg-accent font-semibold text-accent-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
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

        {/* Change password (only when logged in via backend) */}
        {user && <ChangePasswordSection />}

        {/* Preferred location preference */}
        {user && <PreferredLocationSection />}
      </div>
    </>
  )
}
