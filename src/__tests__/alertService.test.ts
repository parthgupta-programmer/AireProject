// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── LocalStorage Mock ─────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true, configurable: true })

vi.mock('@/services/authService', () => ({
  getStoredToken: vi.fn(() => null),
}))

import {
  createAlertRule,
  deleteAlertRule,
  dismissAlertEvent,
  evaluateAlerts,
  fetchAlertEvents,
  fetchAlertRules,
  getBrowserNotificationPermission,
  markAlertEventRead,
  markAllAlertEventsRead,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
  updateAlertRule,
  type AlertRule,
  type EvaluationInput,
} from '@/services/alertService'

const LOCAL_RULES_KEY = 'aire.local.alert_rules'
const LOCAL_EVENTS_KEY = 'aire.local.alert_events'

function clearStorage() {
  // Wipe entire mock store, then seed empty arrays so getLocalRules()
  // never triggers DEFAULT_LOCAL_RULES seeding during tests
  localStorageMock.clear()
  localStorageMock.setItem(LOCAL_RULES_KEY, JSON.stringify([]))
  localStorageMock.setItem(LOCAL_EVENTS_KEY, JSON.stringify([]))
}


function makeRule(overrides: Partial<AlertRule> = {}): Omit<AlertRule, 'id' | 'created_at' | 'updated_at'> {
  return {
    location_id: 'delhi',
    location_name: 'Delhi',
    condition_type: 'above_threshold',
    threshold_value: 200,
    severity_category: 'poor',
    enabled: true,
    channel_in_app: true,
    channel_browser: false,
    last_evaluated_at: null,
    last_triggered_at: null,
    last_seen_aqi: null,
    ...overrides,
  }
}

function makeObservation(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    locationId: 'delhi',
    locationName: 'Delhi',
    currentAqi: 250,
    category: 'poor',
    observationTimestamp: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

describe('Rule CRUD (localStorage, unauthenticated)', () => {
  beforeEach(clearStorage)
  afterEach(clearStorage)

  it('creates and persists a new alert rule', async () => {
    const rule = await createAlertRule(makeRule())
    expect(rule.id).toBeDefined()
    expect(rule.location_id).toBe('delhi')
    expect(rule.threshold_value).toBe(200)
    const rules = await fetchAlertRules()
    expect(rules.some((r) => r.id === rule.id)).toBe(true)
  })

  it('updates an existing rule', async () => {
    const rule = await createAlertRule(makeRule())
    const updated = await updateAlertRule(rule.id, { threshold_value: 300, enabled: false })
    expect(updated.threshold_value).toBe(300)
    expect(updated.enabled).toBe(false)
    const rules = await fetchAlertRules()
    const found = rules.find((r) => r.id === rule.id)
    expect(found?.threshold_value).toBe(300)
  })

  it('deletes a rule', async () => {
    const rule = await createAlertRule(makeRule())
    await deleteAlertRule(rule.id)
    const rules = await fetchAlertRules()
    expect(rules.find((r) => r.id === rule.id)).toBeUndefined()
  })

  it('throws when updating a non-existent rule', async () => {
    await expect(updateAlertRule('non-existent-id', { enabled: false })).rejects.toThrow()
  })

  it('multiple rules coexist independently', async () => {
    const r1 = await createAlertRule(makeRule({ location_id: 'delhi', threshold_value: 100 }))
    const r2 = await createAlertRule(makeRule({ location_id: 'mumbai', location_name: 'Mumbai', threshold_value: 150 }))
    const rules = await fetchAlertRules()
    expect(rules.find((r) => r.id === r1.id)?.threshold_value).toBe(100)
    expect(rules.find((r) => r.id === r2.id)?.threshold_value).toBe(150)
  })
})

describe('Threshold crossing (above_threshold)', () => {
  beforeEach(clearStorage)
  afterEach(clearStorage)

  it('fires when AQI first crosses above threshold', async () => {
    await createAlertRule(makeRule({ threshold_value: 200, last_seen_aqi: null }))
    const events = await evaluateAlerts(makeObservation({ currentAqi: 250 }))
    expect(events).toHaveLength(1)
    expect(events[0].aqi).toBe(250)
    expect(events[0].condition_type).toBe('above_threshold')
    expect(events[0].is_read).toBe(false)
  })

  it('does NOT fire if AQI was already above threshold', async () => {
    const rule = await createAlertRule(makeRule({ threshold_value: 200, last_seen_aqi: null }))
    await updateAlertRule(rule.id, { last_seen_aqi: 220 })
    const events = await evaluateAlerts(makeObservation({ currentAqi: 250 }))
    expect(events).toHaveLength(0)
  })

  it('ignores disabled rules', async () => {
    await createAlertRule(makeRule({ enabled: false }))
    const events = await evaluateAlerts(makeObservation({ currentAqi: 250 }))
    expect(events).toHaveLength(0)
  })

  it('does NOT fire when AQI is below threshold', async () => {
    await createAlertRule(makeRule({ threshold_value: 300, last_seen_aqi: null }))
    const events = await evaluateAlerts(makeObservation({ currentAqi: 150 }))
    expect(events).toHaveLength(0)
  })

  it('fires at exact threshold boundary (>= threshold)', async () => {
    await createAlertRule(makeRule({ threshold_value: 200, last_seen_aqi: null }))
    const events = await evaluateAlerts(makeObservation({ currentAqi: 200 }))
    expect(events).toHaveLength(1)
  })
})

describe('Recovery / improvement (below_threshold_improvement)', () => {
  beforeEach(clearStorage)
  afterEach(clearStorage)

  it('fires when AQI drops below threshold after being above', async () => {
    const rule = await createAlertRule(
      makeRule({ condition_type: 'below_threshold_improvement', threshold_value: 200, last_seen_aqi: null }),
    )
    await updateAlertRule(rule.id, { last_seen_aqi: 220 })
    const events = await evaluateAlerts(makeObservation({ currentAqi: 150, category: 'moderate' }))
    expect(events).toHaveLength(1)
    expect(events[0].condition_type).toBe('below_threshold_improvement')
  })

  it('does NOT fire improvement without prior observation', async () => {
    await createAlertRule(
      makeRule({ condition_type: 'below_threshold_improvement', threshold_value: 200, last_seen_aqi: null }),
    )
    const events = await evaluateAlerts(makeObservation({ currentAqi: 150, category: 'moderate' }))
    expect(events).toHaveLength(0)
  })

  it('does NOT fire if prior AQI was already below threshold', async () => {
    const rule = await createAlertRule(
      makeRule({ condition_type: 'below_threshold_improvement', threshold_value: 200, last_seen_aqi: null }),
    )
    await updateAlertRule(rule.id, { last_seen_aqi: 100 })
    const events = await evaluateAlerts(makeObservation({ currentAqi: 80, category: 'moderate' }))
    expect(events).toHaveLength(0)
  })
})

describe('Idempotency / duplicate prevention', () => {
  beforeEach(clearStorage)
  afterEach(clearStorage)

  it('does NOT duplicate events for same observation timestamp + AQI', async () => {
    await createAlertRule(makeRule({ threshold_value: 200, last_seen_aqi: null }))
    const obs = makeObservation({ currentAqi: 250, observationTimestamp: '2024-01-15T10:00:00Z' })
    const events1 = await evaluateAlerts(obs)
    expect(events1).toHaveLength(1)
    const rules = await fetchAlertRules()
    await updateAlertRule(rules[0].id, { last_seen_aqi: null })
    const events2 = await evaluateAlerts(obs)
    expect(events2).toHaveLength(0)
  })

  it('allows new event for different observation timestamp', async () => {
    await createAlertRule(makeRule({ threshold_value: 200, last_seen_aqi: null }))
    const obs1 = makeObservation({ currentAqi: 250, observationTimestamp: '2024-01-15T10:00:00Z' })
    await evaluateAlerts(obs1)
    const rules = await fetchAlertRules()
    await updateAlertRule(rules[0].id, { last_seen_aqi: null })
    const obs2 = makeObservation({ currentAqi: 260, observationTimestamp: '2024-01-15T11:00:00Z' })
    const events2 = await evaluateAlerts(obs2)
    expect(events2).toHaveLength(1)
    expect(events2[0].aqi).toBe(260)
  })
})

describe('Location isolation', () => {
  beforeEach(clearStorage)
  afterEach(clearStorage)

  it('only evaluates rules matching the observation location', async () => {
    await createAlertRule(makeRule({ location_id: 'mumbai', location_name: 'Mumbai', threshold_value: 100 }))
    await createAlertRule(makeRule({ location_id: 'delhi', location_name: 'Delhi', threshold_value: 100 }))
    const events = await evaluateAlerts(makeObservation({ locationId: 'delhi', currentAqi: 200 }))
    expect(events).toHaveLength(1)
    expect(events[0].location_id).toBe('delhi')
  })
})

describe('Missing / stale AQI handling', () => {
  beforeEach(clearStorage)
  afterEach(clearStorage)

  it('returns no events when no rules exist for location', async () => {
    localStorage.setItem(LOCAL_RULES_KEY, JSON.stringify([]))
    const events = await evaluateAlerts(makeObservation())
    expect(events).toHaveLength(0)
  })
})

describe('In-app notification history', () => {
  beforeEach(clearStorage)
  afterEach(clearStorage)

  it('records events persistently', async () => {
    await createAlertRule(makeRule({ threshold_value: 200, last_seen_aqi: null }))
    await evaluateAlerts(makeObservation({ currentAqi: 250 }))
    const events = await fetchAlertEvents()
    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events[0].is_read).toBe(false)
  })

  it('marks a single event as read', async () => {
    await createAlertRule(makeRule({ threshold_value: 200, last_seen_aqi: null }))
    await evaluateAlerts(makeObservation({ currentAqi: 250 }))
    const events = await fetchAlertEvents()
    const eventId = events[0].id
    await markAlertEventRead(eventId)
    const after = await fetchAlertEvents()
    expect(after.find((e) => e.id === eventId)?.is_read).toBe(true)
  })

  it('marks all events as read', async () => {
    await createAlertRule(makeRule({ threshold_value: 200, last_seen_aqi: null }))
    await evaluateAlerts(makeObservation({ currentAqi: 250, observationTimestamp: '2024-01-15T10:00:00Z' }))
    const rules = await fetchAlertRules()
    await updateAlertRule(rules[0].id, { last_seen_aqi: null })
    await evaluateAlerts(makeObservation({ currentAqi: 260, observationTimestamp: '2024-01-15T11:00:00Z' }))
    await markAllAlertEventsRead()
    const events = await fetchAlertEvents()
    expect(events.every((e) => e.is_read)).toBe(true)
  })

  it('dismisses an event', async () => {
    await createAlertRule(makeRule({ threshold_value: 200, last_seen_aqi: null }))
    await evaluateAlerts(makeObservation({ currentAqi: 250 }))
    const before = await fetchAlertEvents()
    const eventId = before[0].id
    await dismissAlertEvent(eventId)
    const after = await fetchAlertEvents()
    expect(after.find((e) => e.id === eventId)).toBeUndefined()
  })
})

describe('Browser notification permission handling', () => {
  it('returns "unsupported" when Notification API is absent', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original = (globalThis as any).Notification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).Notification
    const state = getBrowserNotificationPermission()
    expect(state).toBe('unsupported')
    if (original) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).Notification = original
    }
  })

  it('returns a valid permission state', () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const state = getBrowserNotificationPermission()
    expect(['default', 'granted', 'denied', 'unsupported']).toContain(state)
  })

  it('does NOT send notification when permission is not granted', () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    Object.defineProperty(Notification, 'permission', { value: 'default', configurable: true })
    const result = sendBrowserNotification('Test notification')
    expect(result).toBe(false)
  })

  it('requestBrowserNotificationPermission returns a valid state', async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      const state = await requestBrowserNotificationPermission()
      expect(state).toBe('unsupported')
      return
    }
    const state = await requestBrowserNotificationPermission()
    expect(['default', 'granted', 'denied', 'unsupported']).toContain(state)
  })
})

describe('Category reach evaluation', () => {
  beforeEach(clearStorage)
  afterEach(clearStorage)

  it('fires when AQI reaches configured severity category', async () => {
    await createAlertRule(
      makeRule({ condition_type: 'category_reach', severity_category: 'poor', threshold_value: 200, last_seen_aqi: null }),
    )
    const events = await evaluateAlerts(makeObservation({ currentAqi: 210, category: 'poor' }))
    expect(events).toHaveLength(1)
    expect(events[0].condition_type).toBe('category_reach')
  })

  it('does NOT fire when AQI is in a different category', async () => {
    await createAlertRule(
      makeRule({ condition_type: 'category_reach', severity_category: 'severe', threshold_value: 300, last_seen_aqi: null }),
    )
    const events = await evaluateAlerts(makeObservation({ currentAqi: 210, category: 'poor' }))
    expect(events).toHaveLength(0)
  })
})
