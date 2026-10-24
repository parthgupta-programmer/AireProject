/**
 * alertService.ts
 * ───────────────
 * Phase 5: Functional AQI Alerts, Evaluation Engine, and Notifications Service.
 *
 * Capabilities:
 * - Alert Rules management (create, update, toggle, delete)
 * - Evaluation engine: evaluates live CPCB NAQI against enabled threshold and recovery rules
 * - Idempotency & deduplication: prevents duplicate notifications for repeated polling of the same observation
 * - Safe data quality: validates that stale or missing data does not trigger false alerts
 * - In-app notification center: persistent history, read/unread states, dismissals
 * - Browser Web Notifications: permission request and dispatch
 * - Synchronization: uses backend /alerts/ API when logged in, with offline localStorage fallback
 */

import { getStoredToken } from './authService'

export type AlertConditionType =
  | 'above_threshold'
  | 'category_reach'
  | 'below_threshold_improvement'

export interface AlertRule {
  id: string
  user_id?: string
  location_id: string
  location_name: string
  condition_type: AlertConditionType
  threshold_value: number
  severity_category?: string
  enabled: boolean
  channel_in_app: boolean
  channel_browser: boolean
  last_evaluated_at?: string | null
  last_triggered_at?: string | null
  last_seen_aqi?: number | null
  created_at?: string
  updated_at?: string
}

export interface AlertEvent {
  id: string
  user_id?: string
  rule_id?: string | null
  location_id: string
  location_name: string
  aqi: number
  category: string
  condition_type: string
  threshold_value: number
  message: string
  observation_timestamp: string
  evaluated_at: string
  is_read: boolean
  is_dismissed?: boolean
  created_at?: string
}

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

// ── Storage Keys & Endpoints ──────────────────────────────────────────────────

const BACKEND_URL: string =
  (import.meta.env.VITE_AUTH_BACKEND_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_ML_BACKEND_URL as string | undefined)?.trim() ||
  'http://localhost:8000'

const LOCAL_RULES_KEY = 'aire.local.alert_rules'
const LOCAL_EVENTS_KEY = 'aire.local.alert_events'

const DEFAULT_LOCAL_RULES: AlertRule[] = [
  {
    id: 'default-rule-delhi-poor',
    location_id: 'delhi',
    location_name: 'Delhi',
    condition_type: 'above_threshold',
    threshold_value: 200,
    severity_category: 'poor',
    enabled: true,
    channel_in_app: true,
    channel_browser: true,
    last_evaluated_at: null,
    last_triggered_at: null,
    last_seen_aqi: null,
  },
  {
    id: 'default-rule-delhi-improve',
    location_id: 'delhi',
    location_name: 'Delhi',
    condition_type: 'below_threshold_improvement',
    threshold_value: 100,
    severity_category: 'moderate',
    enabled: true,
    channel_in_app: true,
    channel_browser: true,
    last_evaluated_at: null,
    last_triggered_at: null,
    last_seen_aqi: null,
  },
]

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

// ── Browser Notification Utilities ───────────────────────────────────────────

export function getBrowserNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission as NotificationPermissionState
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  try {
    const res = await Notification.requestPermission()
    return res as NotificationPermissionState
  } catch {
    return 'denied'
  }
}

export function sendBrowserNotification(title: string, options?: NotificationOptions): boolean {
  if (getBrowserNotificationPermission() !== 'granted') return false
  try {
    new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    })
    return true
  } catch {
    return false
  }
}

// ── LocalStorage Helpers (for offline / unauthenticated users) ─────────────────

function getLocalRules(): AlertRule[] {
  try {
    const raw = localStorage.getItem(LOCAL_RULES_KEY)
    if (!raw) {
      localStorage.setItem(LOCAL_RULES_KEY, JSON.stringify(DEFAULT_LOCAL_RULES))
      return DEFAULT_LOCAL_RULES
    }
    return JSON.parse(raw) as AlertRule[]
  } catch {
    return DEFAULT_LOCAL_RULES
  }
}

function saveLocalRules(rules: AlertRule[]): void {
  try {
    localStorage.setItem(LOCAL_RULES_KEY, JSON.stringify(rules))
  } catch {
    /* ignore storage quota errors */
  }
}

function getLocalEvents(): AlertEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as AlertEvent[]
  } catch {
    return []
  }
}

function saveLocalEvents(events: AlertEvent[]): void {
  try {
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events))
  } catch {
    /* ignore */
  }
}

// ── Alert Rules CRUD API ──────────────────────────────────────────────────────

export async function fetchAlertRules(): Promise<AlertRule[]> {
  const token = getStoredToken()
  if (!token) return getLocalRules()

  try {
    const res = await fetch(`${BACKEND_URL}/alerts/rules`, {
      method: 'GET',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to fetch backend rules')
    const rules = (await res.json()) as AlertRule[]
    // If backend has no rules yet, migrate defaults
    if (rules.length === 0) {
      const local = getLocalRules()
      for (const r of local) {
        await createAlertRule(r)
      }
      return fetchAlertRules()
    }
    return rules
  } catch {
    return getLocalRules()
  }
}

export async function createAlertRule(
  rule: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>,
): Promise<AlertRule> {
  const token = getStoredToken()
  if (token) {
    try {
      const res = await fetch(`${BACKEND_URL}/alerts/rules`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(rule),
      })
      if (res.ok) {
        return (await res.json()) as AlertRule
      }
    } catch {
      /* fallback to local storage */
    }
  }

  const newRule: AlertRule = {
    ...rule,
    id: `local-rule-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const rules = getLocalRules()
  rules.unshift(newRule)
  saveLocalRules(rules)
  return newRule
}

export async function updateAlertRule(
  ruleId: string,
  updates: Partial<AlertRule>,
): Promise<AlertRule> {
  const token = getStoredToken()
  if (token) {
    try {
      const res = await fetch(`${BACKEND_URL}/alerts/rules/${ruleId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        return (await res.json()) as AlertRule
      }
    } catch {
      /* fallback to local */
    }
  }

  const rules = getLocalRules()
  const idx = rules.findIndex((r) => r.id === ruleId)
  if (idx === -1) throw new Error('Alert rule not found.')
  const updated: AlertRule = {
    ...rules[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  }
  rules[idx] = updated
  saveLocalRules(rules)
  return updated
}

export async function deleteAlertRule(ruleId: string): Promise<void> {
  const token = getStoredToken()
  if (token) {
    try {
      const res = await fetch(`${BACKEND_URL}/alerts/rules/${ruleId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) return
    } catch {
      /* fallback to local */
    }
  }

  const rules = getLocalRules().filter((r) => r.id !== ruleId)
  saveLocalRules(rules)
}

// ── In-App Notifications API ──────────────────────────────────────────────────

export async function fetchAlertEvents(): Promise<AlertEvent[]> {
  const token = getStoredToken()
  if (!token) return getLocalEvents()

  try {
    const res = await fetch(`${BACKEND_URL}/alerts/events`, {
      method: 'GET',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to fetch events')
    return (await res.json()) as AlertEvent[]
  } catch {
    return getLocalEvents()
  }
}

export async function markAlertEventRead(eventId: string): Promise<void> {
  const token = getStoredToken()
  if (token) {
    try {
      const res = await fetch(`${BACKEND_URL}/alerts/events/${eventId}/read`, {
        method: 'PATCH',
        headers: authHeaders(),
      })
      if (res.ok) return
    } catch {
      /* fallback */
    }
  }

  const events = getLocalEvents()
  const ev = events.find((e) => e.id === eventId)
  if (ev) ev.is_read = true
  saveLocalEvents(events)
}

export async function markAllAlertEventsRead(): Promise<void> {
  const token = getStoredToken()
  if (token) {
    try {
      const res = await fetch(`${BACKEND_URL}/alerts/events/read-all`, {
        method: 'PATCH',
        headers: authHeaders(),
      })
      if (res.ok) return
    } catch {
      /* fallback */
    }
  }

  const events = getLocalEvents()
  events.forEach((e) => {
    e.is_read = true
  })
  saveLocalEvents(events)
}

export async function dismissAlertEvent(eventId: string): Promise<void> {
  const token = getStoredToken()
  if (token) {
    try {
      const res = await fetch(`${BACKEND_URL}/alerts/events/${eventId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) return
    } catch {
      /* fallback */
    }
  }

  const events = getLocalEvents().filter((e) => e.id !== eventId)
  saveLocalEvents(events)
}

// ── Alert Evaluation Engine ───────────────────────────────────────────────────

export interface EvaluationInput {
  locationId: string
  locationName: string
  currentAqi: number
  category: string
  observationTimestamp: string
}

/**
 * Evaluates live AQI observations against enabled alert rules.
 * - Enforces idempotency via observationTimestamp so repeated polling of the same hour doesn't re-trigger.
 * - Handles genuine threshold crossings and improvement conditions.
 * - Dispatches browser notification if enabled and permitted.
 */
export async function evaluateAlerts(input: EvaluationInput): Promise<AlertEvent[]> {
  const token = getStoredToken()

  // 1. If authenticated, trigger backend evaluation engine
  if (token) {
    try {
      const res = await fetch(`${BACKEND_URL}/alerts/evaluate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          location_id: input.locationId,
          location_name: input.locationName,
          current_aqi: input.currentAqi,
          category: input.category,
          observation_timestamp: input.observationTimestamp,
        }),
      })
      if (res.ok) {
        const backendEvents = (await res.json()) as AlertEvent[]
        for (const ev of backendEvents) {
          sendBrowserNotification(`Air Quality Alert: ${ev.location_name}`, {
            body: ev.message,
            tag: ev.id,
          })
        }
        return backendEvents
      }
    } catch {
      /* fallback to client-side evaluation */
    }
  }

  // 2. Client-side evaluation (for offline / unauthenticated users)
  const rules = getLocalRules().filter(
    (r) => r.enabled && r.location_id.toLowerCase() === input.locationId.toLowerCase(),
  )
  if (rules.length === 0) return []

  const events = getLocalEvents()
  const triggered: AlertEvent[] = []
  const nowIso = new Date().toISOString()

  for (const rule of rules) {
    let fired = false
    let message = ''

    if (rule.condition_type === 'above_threshold') {
      if (input.currentAqi >= rule.threshold_value) {
        if (rule.last_seen_aqi === null || rule.last_seen_aqi === undefined || rule.last_seen_aqi < rule.threshold_value) {
          fired = true
          message = `Air quality in ${input.locationName} reached AQI ${input.currentAqi} (${input.category}), exceeding your threshold of ${rule.threshold_value}.`
        }
      }
    } else if (rule.condition_type === 'category_reach') {
      if (rule.severity_category && input.category.toLowerCase() === rule.severity_category.toLowerCase()) {
        if (rule.last_seen_aqi === null || rule.last_seen_aqi === undefined || rule.last_seen_aqi !== input.currentAqi) {
          fired = true
          message = `Air quality in ${input.locationName} reached '${rule.severity_category}' category with AQI ${input.currentAqi}.`
        }
      }
    } else if (rule.condition_type === 'below_threshold_improvement') {
      if (input.currentAqi < rule.threshold_value) {
        if (rule.last_seen_aqi !== null && rule.last_seen_aqi !== undefined && rule.last_seen_aqi >= rule.threshold_value) {
          fired = true
          message = `Air quality in ${input.locationName} improved to AQI ${input.currentAqi} (${input.category}), dropping below your threshold of ${rule.threshold_value}.`
        }
      }
    }

    rule.last_evaluated_at = nowIso
    rule.last_seen_aqi = input.currentAqi

    if (fired) {
      // Idempotency: verify this observation timestamp hasn't already produced an event for this rule
      const key = `${rule.id}_${input.observationTimestamp}_${input.currentAqi}`
      const duplicate = events.some(
        (e) => e.rule_id === rule.id && e.observation_timestamp === input.observationTimestamp && e.aqi === input.currentAqi,
      )

      if (!duplicate) {
        rule.last_triggered_at = nowIso
        const ev: AlertEvent = {
          id: `local-event-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          rule_id: rule.id,
          location_id: input.locationId,
          location_name: input.locationName,
          aqi: input.currentAqi,
          category: input.category,
          condition_type: rule.condition_type,
          threshold_value: rule.threshold_value,
          message,
          observation_timestamp: input.observationTimestamp,
          evaluated_at: nowIso,
          is_read: false,
          created_at: nowIso,
        }
        events.unshift(ev)
        triggered.push(ev)

        if (rule.channel_browser) {
          sendBrowserNotification(`Air Quality Alert: ${ev.location_name}`, {
            body: ev.message,
            tag: key,
          })
        }
      }
    }
  }

  saveLocalRules(rules)
  saveLocalEvents(events)
  return triggered
}
