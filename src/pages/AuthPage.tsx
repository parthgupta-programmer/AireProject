import { useId, useState, type FormEvent } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthError } from '@/services/authService'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/layout/Logo'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

type Mode = 'login' | 'signup'
type Errors = Partial<Record<'name' | 'email' | 'password' | 'confirm', string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MIN_PASSWORD = 8

function validate(mode: Mode, v: { name: string; email: string; password: string; confirm: string }): Errors {
  const e: Errors = {}
  if (mode === 'signup' && !v.name.trim()) e.name = 'Enter your name.'
  if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email address.'
  if (mode === 'login' ? !v.password : v.password.length < MIN_PASSWORD)
    e.password = mode === 'login' ? 'Enter your password.' : `Use at least ${MIN_PASSWORD} characters.`
  if (mode === 'signup' && v.confirm !== v.password) e.confirm = 'Passwords do not match.'
  return e
}

function Field({ label, error, id, children }: { label: string; error?: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-aqi-very-poor">
          {error}
        </p>
      )}
    </div>
  )
}

export default function AuthPage({ mode }: { mode: Mode }) {
  const { user, logIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const uid = useId()
  const isSignup = mode === 'signup'

  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  if (user && !busy) return <Navigate to={from} replace />

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate(mode, values)
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      if (isSignup) await signUp({ name: values.name, email: values.email, password: values.password })
      else await logIn({ email: values.email, password: values.password })
      navigate(from, { replace: true })
    } catch (err) {
      setFormError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  const id = (name: string) => `${uid}-${name}`
  const describe = (name: keyof Errors) => (errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${id(name)}-error` } : {})

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto grid w-full max-w-md flex-1 content-center px-4 pb-16">
        <h1 className="text-2xl font-semibold tracking-tight">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          {isSignup ? 'Sign up to track the air you breathe across India.' : 'Log in to see live air quality near you.'}
        </p>
        <Card>
          <CardContent>
            <form onSubmit={submit} noValidate className="space-y-4">
              {isSignup && (
                <Field label="Name" id={id('name')} error={errors.name}>
                  <Input id={id('name')} autoComplete="name" value={values.name} onChange={set('name')} {...describe('name')} />
                </Field>
              )}
              <Field label="Email" id={id('email')} error={errors.email}>
                <Input id={id('email')} type="email" autoComplete="email" inputMode="email" value={values.email} onChange={set('email')} {...describe('email')} />
              </Field>
              <Field label="Password" id={id('password')} error={errors.password}>
                <div className="relative">
                  <Input
                    id={id('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    value={values.password}
                    onChange={set('password')}
                    className="pr-10"
                    {...describe('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                  </button>
                </div>
                {isSignup && !errors.password && <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>}
              </Field>
              {isSignup && (
                <Field label="Confirm password" id={id('confirm')} error={errors.confirm}>
                  <Input id={id('confirm')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={values.confirm} onChange={set('confirm')} {...describe('confirm')} />
                </Field>
              )}

              {formError && (
                <p role="alert" className="rounded-md bg-muted px-3 py-2 text-sm text-aqi-very-poor">
                  {formError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                {isSignup ? 'Create account' : 'Log in'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isSignup ? 'Already have an account?' : 'New to Aire?'}{' '}
          <Link to={isSignup ? '/login' : '/signup'} state={location.state} className="font-medium text-primary underline-offset-2 hover:underline">
            {isSignup ? 'Log in' : 'Create an account'}
          </Link>
        </p>
      </main>
    </div>
  )
}
