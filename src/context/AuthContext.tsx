import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import * as auth from '@/services/authService'
import type { AuthUser } from '@/services/authService'

interface AuthContextValue {
  user: AuthUser | null
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>
  logIn: (input: { email: string; password: string }) => Promise<void>
  logOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => auth.getSession())

  const signUp = useCallback<AuthContextValue['signUp']>(async (input) => setUser(await auth.signUp(input)), [])
  const logIn = useCallback<AuthContextValue['logIn']>(async (input) => setUser(await auth.logIn(input)), [])
  const logOut = useCallback(() => {
    auth.logOut()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, signUp, logIn, logOut }), [user, signUp, logIn, logOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
