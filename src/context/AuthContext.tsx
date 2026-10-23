/**
 * AuthContext.tsx
 * ──────────────
 * Provides authentication state across the entire React application.
 *
 * Session lifecycle:
 *  1. On mount, optimistically restore the cached user (instant first paint).
 *  2. Concurrently call verifySession() to confirm the session with the backend.
 *  3. Expose `initialising` so gates/guards can wait before redirecting.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as auth from '@/services/authService'
import type { AuthUser } from '@/services/authService'

interface AuthContextValue {
  /** Authenticated user, or null when logged out. */
  user: AuthUser | null
  /**
   * True while the initial backend session check is in progress.
   * Route guards must wait for this to be false before redirecting.
   */
  initialising: boolean
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>
  logIn: (input: { email: string; password: string }) => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Optimistic state from cache — provides instant first-paint for returning users.
  const [user, setUser] = useState<AuthUser | null>(() => auth.getSession())
  // True until we have heard back from the backend.
  const [initialising, setInitialising] = useState(true)

  useEffect(() => {
    let cancelled = false
    auth.verifySession().then((verified) => {
      if (!cancelled) {
        setUser(verified)
        setInitialising(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const signUp = useCallback<AuthContextValue['signUp']>(async (input) => {
    const u = await auth.signUp(input)
    setUser(u)
  }, [])

  const logIn = useCallback<AuthContextValue['logIn']>(async (input) => {
    const u = await auth.logIn(input)
    setUser(u)
  }, [])

  const logOut = useCallback(async () => {
    await auth.logOut()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, initialising, signUp, logIn, logOut }),
    [user, initialising, signUp, logIn, logOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
