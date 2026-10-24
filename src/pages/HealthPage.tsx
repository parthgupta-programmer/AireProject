/**
 * HealthPage.tsx
 * ──────────────
 * Phase 5: Environmental Health Guidance & Actionable Recommendations.
 *
 * Evidence-based public health guidance derived from:
 * - Central Pollution Control Board (CPCB) NAQI Guidelines (MoEFCC, Govt. of India)
 * - World Health Organization (WHO) Global Air Quality Guidelines (2021)
 *
 * Provides:
 * - Live AQI category breakdown and primary pollutant drivers
 * - Population-specific precautions (general, children, elderly, respiratory/cardiovascular)
 * - Outdoor activity, sports, and exercise adjustments
 * - Indoor air quality protection (ventilation, HEPA purifiers, wet mopping)
 * - Mask selection guidance (N95/FFP2 vs cloth)
 * - Non-diagnostic public health disclaimer
 */

import { useState } from 'react'
import {
  Activity,
  Baby,
  Clock,
  Heart,
  HeartPulse,
  Home,
  Info,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Wind,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAirQualityData } from '@/context/AirQualityContext'
import { useSelectedLocation } from '@/context/LocationContext'
import { AQI_BG, getAqiCategory, type AqiKey } from '@/lib/aqi'
import { POLLUTANTS } from '@/lib/pollutants'
import { cn } from '@/lib/utils'

interface CategoryGuidance {
  headline: string
  generalAdvice: string
  sensitiveAdvice: string
  exerciseAdvice: string
  indoorAdvice: string
  maskRecommended: boolean
  maskDetail: string
}

const HEALTH_GUIDANCE_BY_CATEGORY: Record<AqiKey, CategoryGuidance> = {
  good: {
    headline: 'Air quality is satisfactory with minimal health impact.',
    generalAdvice: 'Air quality poses little or no risk to the general public. Outdoor activities and open ventilation are safe.',
    sensitiveAdvice: 'Unusually sensitive individuals may enjoy normal outdoor activities without restrictions.',
    exerciseAdvice: 'Ideal conditions for all outdoor workouts, sports, running, and physical training.',
    indoorAdvice: 'Keep windows and doors open during morning and afternoon to allow fresh air circulation.',
    maskRecommended: false,
    maskDetail: 'No mask required for environmental protection.',
  },
  moderate: {
    headline: 'Acceptable air quality; minor breathing discomfort possible for sensitive individuals.',
    generalAdvice: 'Most people can carry out usual outdoor activities. Moderate levels of fine dust are present.',
    sensitiveAdvice: 'People with asthma, COPD, or heart disease should watch for symptoms like wheezing, throat irritation, or shortness of breath.',
    exerciseAdvice: 'Outdoor exercise is fine for healthy adults. Sensitive individuals may want to reduce very intense outdoor cardio.',
    indoorAdvice: 'Normal ventilation is fine. Keep cooking spaces well-ventilated.',
    maskRecommended: false,
    maskDetail: 'Masks are optional; recommended only for individuals with severe respiratory allergies on dusty transit corridors.',
  },
  poor: {
    headline: 'Breathing discomfort to most people on prolonged exposure.',
    generalAdvice: 'Prolonged outdoor exertion can lead to throat irritation, coughing, and eye burning. Take frequent breaks indoors.',
    sensitiveAdvice: 'Children, older adults, and individuals with asthma or cardiovascular conditions should limit prolonged outdoor exertion.',
    exerciseAdvice: 'Move rigorous workouts indoors or exercise early in the morning when ambient traffic dust is lower. Avoid running near major arterial roads.',
    indoorAdvice: 'Close windows during rush hour. Consider running a HEPA air purifier in bedrooms during night hours.',
    maskRecommended: true,
    maskDetail: 'Wear a certified, well-fitted N95 or FFP2 respirator mask when spending more than 30 minutes outdoors or traveling through heavy traffic.',
  },
  veryPoor: {
    headline: 'Respiratory illness on prolonged exposure. Significant health concern.',
    generalAdvice: 'Air quality is unhealthy for everyone. Avoid non-essential outdoor exertion, especially alongside highway corridors and construction zones.',
    sensitiveAdvice: 'Children, elderly, pregnant women, and patients with heart/lung disease should strictly avoid outdoor exposure.',
    exerciseAdvice: 'Do not exercise outdoors. Replace runs and outdoor sports with indoor yoga, stretching, or gym workouts.',
    indoorAdvice: 'Keep all windows and exterior doors closed. Run HEPA air purifiers on high mode. Practice wet-mopping rather than dry sweeping to avoid resuspending indoor dust.',
    maskRecommended: true,
    maskDetail: 'N95 or FFP2 respirator mask is strongly advised for all outdoor transit. Surgical masks or cloth bandanas do not seal fine PM2.5 particulates.',
  },
  severe: {
    headline: 'Hazardous air quality. Serious respiratory impact on both healthy and vulnerable populations.',
    generalAdvice: 'Emergency health condition. Everyone is vulnerable to acute respiratory and cardiovascular stress. Minimize all outdoor exposure.',
    sensitiveAdvice: 'Sensitive individuals should remain strictly indoors. Keep emergency inhalers or prescribed respiratory medications readily accessible.',
    exerciseAdvice: 'Strictly avoid all physical outdoor activities. Even light walking outdoors should be minimized.',
    indoorAdvice: 'Create a clean-air room at home: seal door gaps, run continuous HEPA filtration, avoid burning incense, mosquito coils, or candles.',
    maskRecommended: true,
    maskDetail: 'N95 / FFP2 / N99 respirator mask is essential for any brief step outdoors. Ensure a tight facial seal without air leaks around the nose bridge.',
  },
}

export default function HealthPage() {
  const { location } = useSelectedLocation()
  const { data } = useAirQualityData()
  const [activePollutantTab, setActivePollutantTab] = useState<string>('pm25')

  const aqi = data?.aqi ?? 150
  const category = getAqiCategory(aqi)
  const guidance = HEALTH_GUIDANCE_BY_CATEGORY[category.key]

  const dataAgeMinutes = data?.timestamp
    ? Math.round((Date.now() - new Date(data.timestamp).getTime()) / 60_000)
    : null
  const isStale = dataAgeMinutes !== null && dataAgeMinutes > 180

  return (
    <>
      <PageHeader
        title="Environmental Health Guidance"
        description="Evidence-based recommendations tailored to real-time air quality in your location."
      />

      <div className="space-y-6">
        {/* ── Real-Time Air Quality Health Snapshot ── */}
        <Card className="overflow-hidden border-foreground/15 shadow-sm">
          <div className={cn('h-2 w-full', AQI_BG[category.key])} />
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <MapPin className="size-3.5 text-primary" aria-hidden />
                  <span>{data?.location.name || location?.name || 'Selected City'}</span>
                  <span>·</span>
                  <span>CPCB NAQI Index</span>
                </div>
                <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {guidance.headline}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden />
                  {data?.timestamp ? (
                    <span>
                      Observed: {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {dataAgeMinutes !== null && ` (${dataAgeMinutes < 60 ? `${dataAgeMinutes}m ago` : `${Math.round(dataAgeMinutes / 60)}h ago`})`}
                    </span>
                  ) : (
                    <span>Live satellite & atmospheric observation</span>
                  )}
                  {isStale && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      (Reading is older than 3 hours; showing baseline precautionary advice)
                    </span>
                  )}
                </div>
              </div>

              {/* Category & AQI Big Badge */}
              <div className="flex items-center gap-3 self-start sm:self-center">
                <div
                  className={cn(
                    'flex flex-col items-center justify-center rounded-2xl px-5 py-3 text-white shadow-md',
                    AQI_BG[category.key],
                  )}
                >
                  <span className="text-xs font-bold uppercase tracking-wider opacity-90">
                    {category.label}
                  </span>
                  <span className="font-display text-4xl font-extrabold leading-none tracking-tight">
                    {data ? aqi : '—'}
                  </span>
                  <span className="mt-1 text-[10px] font-medium opacity-85">NAQI</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Targeted Precautions Grid ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* General Public */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="size-4 text-blue-500" aria-hidden />
                <span>General Public</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed">
              {guidance.generalAdvice}
            </CardContent>
          </Card>

          {/* Sensitive Groups */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Baby className="size-4 text-amber-500" aria-hidden />
                <span>Children, Elderly & Sensitive Groups</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed">
              {guidance.sensitiveAdvice}
            </CardContent>
          </Card>

          {/* Outdoor Workouts & Exercise */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HeartPulse className="size-4 text-emerald-500" aria-hidden />
                <span>Outdoor Activities & Exercise</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed">
              {guidance.exerciseAdvice}
            </CardContent>
          </Card>

          {/* Indoor Air Quality */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Home className="size-4 text-indigo-500" aria-hidden />
                <span>Indoor Protection & Ventilation</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed">
              {guidance.indoorAdvice}
            </CardContent>
          </Card>

          {/* Respirator / Mask Guidance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {guidance.maskRecommended ? (
                  <ShieldAlert className="size-4 text-rose-500" aria-hidden />
                ) : (
                  <ShieldCheck className="size-4 text-teal-500" aria-hidden />
                )}
                <span>Mask & Respirator Recommendations</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed">
              {guidance.maskDetail}
            </CardContent>
          </Card>

          {/* Vulnerable Organ Systems */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Heart className="size-4 text-rose-400" aria-hidden />
                <span>Cardiovascular & Lung Health</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed">
              Fine particles penetrate into deep alveoli and enter systemic circulation. Stay hydrated, avoid heavy tobacco/cooking smoke, and consult a physician if chest tightness occurs.
            </CardContent>
          </Card>
        </div>

        {/* ── Pollutants & Physiological Effects Deep-Dive ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Wind className="size-4 text-primary" aria-hidden />
              <span>Pollutants & Health Effects Breakdown</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-1.5 border-b border-foreground/10 pb-3">
              {POLLUTANTS.map((p) => {
                const currentVal = data?.pollutants[p.key]
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setActivePollutantTab(p.key)}
                    className={cn(
                      'rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
                      activePollutantTab === p.key
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {p.label}
                    {currentVal !== undefined && (
                      <span className="ml-1.5 opacity-80">
                        ({Math.round(currentVal)} {p.unit})
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {(() => {
              const p = POLLUTANTS.find((x) => x.key === activePollutantTab) || POLLUTANTS[0]
              const currentVal = data?.pollutants[p.key]
              return (
                <div className="grid gap-4 sm:grid-cols-2 text-xs">
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">{p.label}</p>
                    <p className="text-muted-foreground leading-relaxed">{p.description}</p>
                    <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                      <p className="font-semibold">Current Level:</p>
                      <p className="text-sm font-bold text-foreground">
                        {currentVal !== undefined ? `${currentVal} ${p.unit}` : 'Data unavailable'}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        CPCB Satisfactory upper threshold: {p.bounds[1]} {p.unit}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-xl border border-foreground/10 p-4">
                    <p className="font-semibold text-sm">Physiological Impact</p>
                    <ul className="list-disc pl-4 space-y-1.5 text-muted-foreground">
                      {p.key === 'pm25' && (
                        <>
                          <li>Penetrates terminal bronchioles and crosses alveolar-capillary membrane into bloodstream.</li>
                          <li>Elevates inflammatory cytokines, exacerbating coronary artery disease and asthma.</li>
                          <li>Long-term exposure is epidemiologically associated with reduced lung capacity in children.</li>
                        </>
                      )}
                      {p.key === 'pm10' && (
                        <>
                          <li>Trapped predominantly in upper nasopharyngeal and tracheobronchial regions.</li>
                          <li>Triggers mechanical irritation, persistent dry coughing, and ocular conjunctivitis.</li>
                        </>
                      )}
                      {p.key === 'no2' && (
                        <>
                          <li>Potent oxidant gas inflaming airway mucosa and increasing susceptibility to viral bronchitis.</li>
                          <li>Linked to childhood onset asthma alongside high-traffic transport corridors.</li>
                        </>
                      )}
                      {p.key === 'so2' && (
                        <>
                          <li>Causes rapid reflexive bronchoconstriction within 10–15 minutes of inhalation.</li>
                          <li>Particularly hazardous for patients suffering from bronchial hyper-responsiveness.</li>
                        </>
                      )}
                      {p.key === 'co' && (
                        <>
                          <li>Binds hemoglobin with ~200× higher affinity than oxygen, forming carboxyhemoglobin.</li>
                          <li>Impairs oxygen delivery to myocardium and cerebral cortex, causing dizziness and fatigue.</li>
                        </>
                      )}
                      {p.key === 'o3' && (
                        <>
                          <li>Strong reactive oxygen species oxidizing cellular membranes in terminal airways.</li>
                          <li>Reduces forced vital capacity (FVC), peaking during hot sunny mid-afternoons.</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>

        {/* ── Persistent Medical Disclaimer ── */}
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex gap-2.5">
            <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden />
            <div className="space-y-1">
              <p className="font-semibold">Informational Public Health Notice</p>
              <p className="leading-relaxed">
                The health guidance provided by Aire is for general informational and educational awareness based on Central Pollution Control Board (CPCB) and World Health Organization (WHO) environmental standards. This platform does not provide clinical diagnosis, individual medical treatment, or prescription therapy. Individuals with pre-existing cardiopulmonary illnesses must follow management plans prescribed by their qualified physicians.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
