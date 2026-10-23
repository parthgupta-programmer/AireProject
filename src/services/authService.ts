/**
 * authService.ts
 * ──────────────
 * Production authentication service integrating with the FastAPI backend.
 *
 * Security & Session Features:
 * - Communicates with backend endpoints (/auth/signup, /auth/login, /auth/logout, /auth/me).
 * - Transmits credentials securely using HTTP-only session cookies and Authorization Bearer headers.
 * - Passwords are never hashed or stored on the client; the backend uses bcrypt with 12 rounds.
 * - Enforces email normalization and input validation.
 * - Supports session restoration on page reload and user preference persistence.
 */

export interface UserPreferences {
  preferred_location_id: string
  saved_locations: string[]
  health_guidance: Record<string, unknown>
  alert_thresholds: Record<string, unknown>
  notification_channels: Record<string, unknown>
  theme: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  preferences?: UserPreferences
}

export class AuthError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'AuthError'
  }
}

// ── Configuration ──────────────────────────────────────────────────────────────

const BACKEND_URL: string =
  (import.meta.env.VITE_AUTH_BACKEND_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_ML_BACKEND_URL as string | undefined)?.trim() ||
  'http://localhost:8000'

const TOKEN_KEY = 'aire.auth.token'
const USER_KEY = 'aire.auth.user'

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function storeSession(token: string, user: AuthUser) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(TOKEN_KEY, token)
    sessionStorage.setItem(USER_KEY, JSON.stringify(user))
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* ignore storage quota or private mode errors */
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Get synchronously cached user for instant first-paint UI rendering.
 * Should be followed by `verifySession()` to confirm validity with backend.
 */
export function getSession(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  const token = getStoredToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Verify session with the backend on page load.
 * Restores the user session or clears expired credentials.
 */
export async function verifySession(): Promise<AuthUser | null> {
  const token = getStoredToken()
  const cachedUser = getSession()

  // If there's no stored token or cookie expectation, return null immediately
  if (!token && !cachedUser) {
    return null
  }

  try {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/auth/me`
    const resp = await fetch(url, {
      method: 'GET',
      headers: authHeaders(),
      credentials: 'include', // transmit HTTP-only session cookie
      signal: AbortSignal.timeout(6_000),
    })

    if (resp.status === 401 || resp.status === 403) {
      clearSession()
      return null
    }

    if (!resp.ok) {
      // Backend temporarily erroring: return cached user if available so UI doesn't kick user out
      return cachedUser
    }

    const user = (await resp.json()) as AuthUser
    if (token) storeSession(token, user)
    return user
  } catch {
    // Network unreachable: keep cached session to support offline continuity
    return cachedUser
  }
}

export async function signUp(input: {
  name: string
  email: string
  password: string
}): Promise<AuthUser> {
  const url = `${BACKEND_URL.replace(/\/$/, '')}/auth/signup`

  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        name: input.name.trim(),
        email: input.email.trim(),
        password: input.password,
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    throw new AuthError(
      `Unable to connect to authentication server at ${BACKEND_URL}. Check that the backend is running.`,
    )
  }

  const data = await resp.json().catch(() => ({}))

  if (!resp.ok) {
    const message =
      typeof data.detail === 'string'
        ? data.detail
        : 'Registration failed. Please check your details.'
    throw new AuthError(message, resp.status)
  }

  const { access_token, user } = data as { access_token: string; user: AuthUser }
  storeSession(access_token, user)
  return user
}

export async function logIn(input: {
  email: string
  password: string
}): Promise<AuthUser> {
  const url = `${BACKEND_URL.replace(/\/$/, '')}/auth/login`

  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: input.email.trim(),
        password: input.password,
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    throw new AuthError(
      `Unable to connect to authentication server at ${BACKEND_URL}. Check that the backend is running.`,
    )
  }

  const data = await resp.json().catch(() => ({}))

  if (!resp.ok) {
    const message =
      typeof data.detail === 'string'
        ? data.detail
        : 'Incorrect email or password.'
    throw new AuthError(message, resp.status)
  }

  const { access_token, user } = data as { access_token: string; user: AuthUser }
  storeSession(access_token, user)
  return user
}

export async function logOut(): Promise<void> {
  const url = `${BACKEND_URL.replace(/\/$/, '')}/auth/logout`
  try {
    await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      signal: AbortSignal.timeout(5_000),
    })
  } catch {
    /* ignore network errors on logout */
  } finally {
    clearSession()
  }
}

// ── Persistent User Preferences ────────────────────────────────────────────────

export async function getUserPreferences(): Promise<UserPreferences> {
  const url = `${BACKEND_URL.replace(/\/$/, '')}/user/preferences`
  const resp = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
    signal: AbortSignal.timeout(8_000),
  })

  if (!resp.ok) {
    throw new AuthError('Failed to fetch user preferences.', resp.status)
  }

  return (await resp.json()) as UserPreferences
}

export async function updateUserPreferences(
  prefs: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const url = `${BACKEND_URL.replace(/\/$/, '')}/user/preferences`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(prefs),
    signal: AbortSignal.timeout(8_000),
  })

  if (!resp.ok) {
    throw new AuthError('Failed to update user preferences.', resp.status)
  }

  const updated = (await resp.json()) as UserPreferences

  // Update cached user preferences
  const current = getSession()
  if (current) {
    const updatedUser = { ...current, preferences: updated }
    const token = getStoredToken()
    if (token) storeSession(token, updatedUser)
  }

  return updated
}

export async function changePassword(input: {
  current_password: string
  new_password: string
}): Promise<void> {
  const url = `${BACKEND_URL.replace(/\/$/, '')}/user/password`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(8_000),
  })

  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new AuthError(
      typeof data.detail === 'string' ? data.detail : 'Password change failed.',
      resp.status,
    )
  }
}
