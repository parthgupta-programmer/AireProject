/**
 * AlertsPage.tsx
 * ──────────────
 * Phase 5: Functional AQI Alerts and In-App Notification Center.
 *
 * Features:
 * - Alert rules management (create, edit, enable/disable, delete with confirmation)
 * - Threshold validation against India CPCB NAQI standard
 * - Monitored location picker (India locations registry + custom)
 * - In-app notification event history with read/unread status and dismissals
 * - Browser Web Notification permission manager with clear status feedback
 * - Automatic evaluation on fresh ambient AQI observations
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Plus,
  Trash2,
  Volume2,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAirQualityData } from '@/context/AirQualityContext'
import { useSelectedLocation } from '@/context/LocationContext'
import { INDIA_LOCATIONS } from '@/data/indiaLocations'
import { AQI_BG, getAqiCategory, type AqiKey } from '@/lib/aqi'
import { cn } from '@/lib/utils'
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
  updateAlertRule,
  type AlertConditionType,
  type AlertEvent,
  type AlertRule,
  type NotificationPermissionState,
} from '@/services/alertService'

const CONDITION_LABELS: Record<AlertConditionType, string> = {
  above_threshold: 'AQI rises above threshold',
  category_reach: 'AQI reaches severity category',
  below_threshold_improvement: 'AQI improves below threshold',
}

export default function AlertsPage() {
  const { location } = useSelectedLocation()
  const { data: currentAqiData } = useAirQualityData()

  const [rules, setRules] = useState<AlertRule[]>([])
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<AlertRule | null>(null)
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>('default')

  // ── Form State for Rule Modal ──
  const [formLocationId, setFormLocationId] = useState('delhi')
  const [formLocationName, setFormLocationName] = useState('Delhi')
  const [formCondition, setFormCondition] = useState<AlertConditionType>('above_threshold')
  const [formThreshold, setFormThreshold] = useState(200)
  const [formCategory, setFormCategory] = useState<AqiKey>('poor')
  const [formChannelInApp, setFormChannelInApp] = useState(true)
  const [formChannelBrowser, setFormChannelBrowser] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)

  // Load initial rules, events, and permission
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [r, e] = await Promise.all([fetchAlertRules(), fetchAlertEvents()])
      setRules(r)
      setEvents(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    setPermissionState(getBrowserNotificationPermission())
  }, [loadData])

  // Automatically evaluate alerts whenever live observation arrives
  useEffect(() => {
    if (!currentAqiData) return
    const locId = currentAqiData.location.id
    const locName = currentAqiData.location.name
    const aqi = currentAqiData.aqi
    const cat = getAqiCategory(aqi).key
    const obsTime = currentAqiData.timestamp || new Date().toISOString()

    evaluateAlerts({
      locationId: locId,
      locationName: locName,
      currentAqi: aqi,
      category: cat,
      observationTimestamp: obsTime,
    }).then((triggered) => {
      if (triggered.length > 0) {
        // Refresh event history and rules
        loadData()
      }
    })
  }, [currentAqiData, loadData])

  const handleRequestPermission = async () => {
    const res = await requestBrowserNotificationPermission()
    setPermissionState(res)
  }

  const handleOpenCreate = () => {
    setFormLocationId(location?.id || 'delhi')
    setFormLocationName(location?.name || 'Delhi')
    setFormCondition('above_threshold')
    setFormThreshold(200)
    setFormCategory('poor')
    setFormChannelInApp(true)
    setFormChannelBrowser(permissionState === 'granted')
    setFormError(null)
    setEditingRule(null)
    setIsCreating(true)
  }

  const handleOpenEdit = (rule: AlertRule) => {
    setEditingRule(rule)
    setFormLocationId(rule.location_id)
    setFormLocationName(rule.location_name)
    setFormCondition(rule.condition_type)
    setFormThreshold(rule.threshold_value)
    setFormCategory((rule.severity_category as AqiKey) || 'poor')
    setFormChannelInApp(rule.channel_in_app)
    setFormChannelBrowser(rule.channel_browser)
    setFormError(null)
    setIsCreating(true)
  }

  const handleSaveRule = async (e: FormEvent) => {
    e.preventDefault()
    if (formThreshold < 0 || formThreshold > 500) {
      setFormError('Threshold must be within official CPCB NAQI range (0–500).')
      return
    }

    try {
      if (editingRule) {
        await updateAlertRule(editingRule.id, {
          location_id: formLocationId,
          location_name: formLocationName,
          condition_type: formCondition,
          threshold_value: formThreshold,
          severity_category: formCondition === 'category_reach' ? formCategory : undefined,
          channel_in_app: formChannelInApp,
          channel_browser: formChannelBrowser,
        })
      } else {
        await createAlertRule({
          location_id: formLocationId,
          location_name: formLocationName,
          condition_type: formCondition,
          threshold_value: formThreshold,
          severity_category: formCondition === 'category_reach' ? formCategory : undefined,
          enabled: true,
          channel_in_app: formChannelInApp,
          channel_browser: formChannelBrowser,
          last_evaluated_at: null,
          last_triggered_at: null,
          last_seen_aqi: null,
        })
      }
      setIsCreating(false)
      loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save alert rule.')
    }
  }

  const handleToggleRule = async (rule: AlertRule) => {
    try {
      await updateAlertRule(rule.id, { enabled: !rule.enabled })
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)),
      )
    } catch {
      loadData()
    }
  }

  const handleConfirmDelete = async () => {
    if (!ruleToDelete) return
    try {
      await deleteAlertRule(ruleToDelete.id)
      setRuleToDelete(null)
      loadData()
    } catch {
      /* ignore */
    }
  }

  const handleMarkRead = async (eventId: string) => {
    await markAlertEventRead(eventId)
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, is_read: true } : e)),
    )
  }

  const handleMarkAllRead = async () => {
    await markAllAlertEventsRead()
    setEvents((prev) => prev.map((e) => ({ ...e, is_read: true })))
  }

  const handleDismissEvent = async (eventId: string) => {
    await dismissAlertEvent(eventId)
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
  }

  const unreadCount = useMemo(() => events.filter((e) => !e.is_read).length, [events])

  return (
    <>
      <PageHeader
        title="Alerts & Notifications"
        description="Monitor real-time air quality thresholds, configure personal rules, and review event history."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── Left Column: Active Rules ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Active Alert Rules</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {rules.length} rule{rules.length === 1 ? '' : 's'} configured
                </p>
              </div>
              <Button size="sm" onClick={handleOpenCreate} className="gap-1.5">
                <Plus className="size-4" aria-hidden />
                <span>New alert rule</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && (
                <div className="space-y-2.5">
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                </div>
              )}

              {!loading && rules.length === 0 && (
                <div className="rounded-xl border border-dashed border-foreground/15 py-8 text-center text-sm text-muted-foreground">
                  <BellOff className="mx-auto mb-2 size-6 opacity-40" aria-hidden />
                  <p className="font-medium">No alert rules active.</p>
                  <p className="text-xs">Create your first rule to receive threshold alerts.</p>
                </div>
              )}

              {!loading &&
                rules.map((rule) => {
                  const cat = getAqiCategory(rule.threshold_value)
                  return (
                    <div
                      key={rule.id}
                      className={cn(
                        'flex flex-col gap-3 rounded-xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between',
                        rule.enabled
                          ? 'border-foreground/15 bg-card shadow-sm'
                          : 'border-foreground/10 bg-muted/30 opacity-75',
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm">{rule.location_name}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider',
                              rule.enabled
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {rule.enabled ? 'Enabled' : 'Paused'}
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-xs',
                              AQI_BG[cat.key],
                            )}
                          >
                            AQI {rule.threshold_value} ({cat.label})
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {CONDITION_LABELS[rule.condition_type]} · Channels:{' '}
                          {[
                            rule.channel_in_app && 'In-App',
                            rule.channel_browser && 'Browser',
                          ]
                            .filter(Boolean)
                            .join(', ') || 'None'}
                        </p>

                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground/80">
                          {rule.last_triggered_at && (
                            <span>
                              Last triggered:{' '}
                              {new Date(rule.last_triggered_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                          {rule.last_evaluated_at && (
                            <span>
                              Evaluated:{' '}
                              {new Date(rule.last_evaluated_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleRule(rule)}
                          className="h-8 text-xs"
                        >
                          {rule.enabled ? 'Pause' : 'Enable'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(rule)}
                          className="h-8 px-2 text-xs"
                          aria-label="Edit rule"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRuleToDelete(rule)}
                          className="size-8 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                          aria-label="Delete rule"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  )
                })}
            </CardContent>
          </Card>

          {/* ── Browser Notification Permission Card ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Volume2 className="size-4 text-primary" aria-hidden />
                <span>Browser Notification Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-xs">Permission status:</p>
                  <p className="text-xs text-muted-foreground">
                    {permissionState === 'granted' &&
                      'Notifications are allowed. You will receive ambient alerts on your device.'}
                    {permissionState === 'default' &&
                      'Permission not requested yet. Click below to allow notifications.'}
                    {permissionState === 'denied' &&
                      'Notifications blocked. Please enable permissions in your browser URL settings.'}
                    {permissionState === 'unsupported' &&
                      'This browser does not support HTML5 Notifications.'}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                    permissionState === 'granted' && 'bg-emerald-500/15 text-emerald-600',
                    permissionState === 'default' && 'bg-amber-500/15 text-amber-600',
                    permissionState === 'denied' && 'bg-rose-500/15 text-rose-600',
                    permissionState === 'unsupported' && 'bg-muted text-muted-foreground',
                  )}
                >
                  {permissionState}
                </span>
              </div>

              {permissionState === 'default' && (
                <Button size="sm" onClick={handleRequestPermission} className="gap-1.5">
                  <BellRing className="size-3.5" aria-hidden />
                  <span>Enable browser alerts</span>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column: In-App Notification Center ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Notification Center</CardTitle>
                {unreadCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <CheckCheck className="size-3.5 mr-1" aria-hidden />
                  Mark all read
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {events.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <Check className="mx-auto mb-1.5 size-5 opacity-40" aria-hidden />
                  <p>No notifications yet.</p>
                  <p className="mt-0.5 text-[11px]">Alerts trigger when live AQI crosses thresholds.</p>
                </div>
              )}

              {events.map((ev) => {
                const cat = getAqiCategory(ev.aqi)
                return (
                  <div
                    key={ev.id}
                    className={cn(
                      'relative rounded-xl border p-3.5 transition-all text-xs space-y-1.5',
                      ev.is_read
                        ? 'border-foreground/10 bg-muted/20 opacity-80'
                        : 'border-primary/30 bg-primary/5 shadow-xs',
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'size-2 rounded-full',
                            ev.is_read ? 'bg-muted-foreground/40' : 'bg-primary animate-pulse',
                          )}
                          aria-hidden
                        />
                        <span className="font-semibold">{ev.location_name}</span>
                        <span
                          className={cn(
                            'rounded-sm px-1.5 py-0.2 text-[10px] font-bold text-white',
                            AQI_BG[cat.key],
                          )}
                        >
                          AQI {ev.aqi}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(ev.evaluated_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-muted-foreground leading-relaxed">{ev.message}</p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground/70">
                        Observed:{' '}
                        {new Date(ev.observation_timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        {!ev.is_read && (
                          <button
                            type="button"
                            onClick={() => handleMarkRead(ev.id)}
                            className="text-[11px] font-medium text-primary hover:underline"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDismissEvent(ev.id)}
                          className="text-[11px] text-muted-foreground hover:text-foreground"
                          aria-label="Dismiss alert"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Create / Edit Rule Modal ── */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md shadow-xl animate-scale-in">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">
                {editingRule ? 'Edit Alert Rule' : 'New Alert Rule'}
              </CardTitle>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" aria-hidden />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
                {formError && (
                  <div className="rounded-lg bg-rose-500/10 p-2.5 text-xs text-rose-600">
                    {formError}
                  </div>
                )}

                {/* Location Selection */}
                <div>
                  <label htmlFor="alert-location" className="mb-1 block font-semibold text-muted-foreground">
                    Monitored City / Location
                  </label>
                  <select
                    id="alert-location"
                    value={formLocationId}
                    onChange={(e) => {
                      setFormLocationId(e.target.value)
                      const found = INDIA_LOCATIONS.find((l) => l.id === e.target.value)
                      if (found) setFormLocationName(found.name)
                    }}
                    className="w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-hidden"
                  >
                    {INDIA_LOCATIONS.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Condition Type */}
                <div>
                  <label htmlFor="alert-condition" className="mb-1 block font-semibold text-muted-foreground">
                    Trigger Condition
                  </label>
                  <select
                    id="alert-condition"
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value as AlertConditionType)}
                    className="w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-xs font-medium focus:border-primary focus:outline-hidden"
                  >
                    <option value="above_threshold">AQI rises above threshold</option>
                    <option value="category_reach">AQI reaches severity category</option>
                    <option value="below_threshold_improvement">AQI improves below threshold (Recovery)</option>
                  </select>
                </div>

                {/* Threshold Slider & Input */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor="alert-threshold" className="font-semibold text-muted-foreground">
                      CPCB NAQI Threshold (0–500)
                    </label>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold text-white',
                        AQI_BG[getAqiCategory(formThreshold).key],
                      )}
                    >
                      {getAqiCategory(formThreshold).label} ({formThreshold})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="alert-threshold"
                      type="range"
                      min={0}
                      max={500}
                      step={5}
                      value={formThreshold}
                      onChange={(e) => setFormThreshold(Number(e.target.value))}
                      className="flex-1 accent-primary cursor-pointer"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={500}
                      value={formThreshold}
                      onChange={(e) => setFormThreshold(Number(e.target.value))}
                      className="w-16 h-8 text-center text-xs"
                    />
                  </div>
                </div>

                {/* Notification Channels */}
                <div className="space-y-2 pt-1">
                  <span className="font-semibold text-muted-foreground block">Notification Channels</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formChannelInApp}
                      onChange={(e) => setFormChannelInApp(e.target.checked)}
                      className="rounded accent-primary size-3.5"
                    />
                    <span>In-App Notification Center</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formChannelBrowser}
                      onChange={(e) => setFormChannelBrowser(e.target.checked)}
                      className="rounded accent-primary size-3.5"
                    />
                    <span>Browser Web Notification (Desktop / Mobile alert)</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    {editingRule ? 'Save Changes' : 'Create Alert Rule'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Confirm Delete Dialog ── */}
      {ruleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-sm shadow-xl animate-scale-in">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Delete Alert Rule?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <p className="text-muted-foreground">
                Are you sure you want to delete the alert rule for <strong>{ruleToDelete.location_name}</strong> (AQI {ruleToDelete.threshold_value})? You will no longer receive alerts for this condition.
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setRuleToDelete(null)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConfirmDelete}
                >
                  Delete Rule
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
