/**
 * DEMO authentication that runs entirely in the browser.
 *
 * Accounts live in localStorage on this device only, so there is no real security, no password reset and no
 * sync between devices. It exists so the login and sign-up screens work end to end during development.
 *
 * To go live, replace the four exported functions (getSession, signUp, logIn, logOut) with calls to a real
 * backend such as Firebase Auth, Supabase, Auth0 or your own API. Nothing else in the app needs to change.
 */
import { sleep } from './mock'

export interface AuthUser {
  id: string
  name: string
  email: string
}

interface StoredUser extends AuthUser {
  salt: string
  hash: string
  createdAt: string
}

export class AuthError extends Error {}

const USERS_KEY = 'aire.users'
const SESSION_KEY = 'aire.session'
const PBKDF2_ITERATIONS = 150_000

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const normalizeEmail = (email: string) => email.trim().toLowerCase()
const publicUser = ({ id, name, email }: StoredUser): AuthUser => ({ id, name, email })

function readUsers(): StoredUser[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeUsers(users: StoredUser[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  } catch {
    throw new AuthError('Could not save your account. Check that browser storage is enabled.')
  }
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new AuthError('Secure sign-in needs https or localhost.')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256)
  return toB64(bits)
}

/** The signed-in user, if any. Synchronous, so the app can decide what to show on first paint. */
export function getSession(): AuthUser | null {
  try {
    const id = localStorage.getItem(SESSION_KEY)
    const user = id ? readUsers().find((u) => u.id === id) : undefined
    return user ? publicUser(user) : null
  } catch {
    return null
  }
}

function startSession(user: StoredUser) {
  try {
    localStorage.setItem(SESSION_KEY, user.id)
  } catch {
    throw new AuthError('Could not keep you signed in. Check that browser storage is enabled.')
  }
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<AuthUser> {
  await sleep(400)
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const users = readUsers()
  if (users.some((u) => u.email === email)) throw new AuthError('An account with this email already exists. Try logging in.')

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const user: StoredUser = {
    id: crypto.randomUUID(),
    name,
    email,
    salt: toB64(salt),
    hash: await hashPassword(input.password, salt),
    createdAt: new Date().toISOString(),
  }
  writeUsers([...users, user])
  startSession(user)
  return publicUser(user)
}

export async function logIn(input: { email: string; password: string }): Promise<AuthUser> {
  await sleep(400)
  const user = readUsers().find((u) => u.email === normalizeEmail(input.email))
  const hash = user ? await hashPassword(input.password, fromB64(user.salt)) : null
  // Same message for "no such account" and "wrong password", so the form doesn't reveal which emails exist.
  if (!user || hash !== user.hash) throw new AuthError('Incorrect email or password.')
  startSession(user)
  return publicUser(user)
}

export function logOut() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* nothing to clear */
  }
}
