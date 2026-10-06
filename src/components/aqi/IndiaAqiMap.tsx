import { useEffect, useMemo, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Flame } from 'lucide-react'
import { useAirQualityData } from '@/context/AirQualityContext'
import { useSelectedLocation } from '@/context/LocationContext'
import { useTheme } from '@/context/ThemeContext'
import { useNationalAqi } from '@/hooks/useNationalAqi'
import { AQI_BG, getAqiCategory } from '@/lib/aqi'
import { aqiToRgb, legendGradient, readableOn, readHeatColors, rgbString } from '@/lib/heatmap'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import type { CityAqi } from '@/types/airQuality'

// Basemap tiles. Works out of the box with OpenStreetMap (no key). OSM's free tile server is meant for development and
// light use; for a public launch, get a free CARTO Basemaps key (https://carto.com/basemaps/apikey/), put it in
// `.env` as VITE_CARTO_KEY=your_key, and the map switches to CARTO's cleaner style automatically.
const CARTO_KEY = (import.meta.env.VITE_CARTO_KEY as string | undefined)?.trim()
const BASEMAP = CARTO_KEY
  ? {
      url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    }
  : {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }
// One set of light tiles serves both themes; dark mode inverts them with a CSS filter.
const DARK_TILE_FILTER = 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9)'
const INDIA_BOUNDS: L.LatLngBoundsExpression = [[6, 68], [37.5, 97.5]]
const NUMBERS_FROM_ZOOM = 6
const LEGEND_TICKS = [0, 50, 100, 200, 300, 400]

function Legend({ gradient }: { gradient: string }) {
  return (
    <div>
      <div aria-hidden className="h-2.5 w-full rounded-full" style={{ background: gradient }} />
      <div aria-hidden className="relative mt-1 h-4 text-xs text-muted-foreground">
        {LEGEND_TICKS.map((t, i) => (
          <span
            key={t}
            className="absolute"
            style={{ left: `${(t / 400) * 100}%`, transform: i === 0 ? 'none' : i === LEGEND_TICKS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
          >
            {t}
            {i === LEGEND_TICKS.length - 1 && '+'}
          </span>
        ))}
      </div>
      <p className="sr-only">Colour scale from green (good, 0 to 50) through yellow and orange to red and dark maroon (severe, 300 and above).</p>
    </div>
  )
}

function CityRow({ city, onSelect }: { city: CityAqi; onSelect: (c: CityAqi) => void }) {
  const cat = getAqiCategory(city.aqi)
  return (
    <li>
      <button type="button" onClick={() => onSelect(city)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-accent">
        <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', AQI_BG[cat.key])} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{city.location.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{city.location.region}</span>
        </span>
        <span className="font-semibold">{city.aqi}</span>
      </button>
    </li>
  )
}

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function IndiaAqiMap({ className }: { className?: string }) {
  const { data } = useAirQualityData()
  const { location, setLocation } = useSelectedLocation()
  const { status, cities, updatedAt, isRefreshing, retry } = useNationalAqi(data?.timestamp)
  const { resolved } = useTheme()

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [zoom, setZoom] = useState(5)
  const [showHeat, setShowHeat] = useState(true)

  // AQI colours come from CSS variables, which change with the theme. The theme class is applied after render,
  // so watch the <html> class instead of reading the variables during render.
  const [colors, setColors] = useState(readHeatColors)
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readHeatColors()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  const gradient = useMemo(() => legendGradient(colors), [colors])

  const onPick = useRef(setLocation)
  onPick.current = setLocation

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, { minZoom: 4, maxZoom: 10, maxBounds: [[0, 60], [42, 105]], scrollWheelZoom: false })
    map.fitBounds(INDIA_BOUNDS, { padding: [10, 10] })
    // Wheel-zoom only after the map is clicked or focused, so scrolling the page never gets trapped.
    map.on('focus click', () => map.scrollWheelZoom.enable())
    map.on('blur', () => map.scrollWheelZoom.disable())
    map.on('zoomend', () => setZoom(map.getZoom()))
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      tileRef.current = null
      layerRef.current = null
    }
  }, [])

  // Basemap follows the light / dark theme.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!tileRef.current) tileRef.current = L.tileLayer(BASEMAP.url, { attribution: BASEMAP.attribution, maxZoom: 19 }).addTo(map)
    const pane = map.getPane('tilePane')
    if (pane) pane.style.filter = resolved === 'dark' ? DARK_TILE_FILTER : ''
  }, [resolved])

  // Draw the live AQI layers.
  useEffect(() => {
    const group = layerRef.current
    if (!group) return
    group.clearLayers()
    // soft, overlapping colour discs read as a heat map; they keep roughly the same size on screen as you zoom
    const heatRadius = 80_000 / 2 ** (0.7 * Math.max(0, zoom - 5))

    for (const c of [...cities].sort((a, b) => a.aqi - b.aqi)) {
      const rgb = aqiToRgb(c.aqi, colors)
      const fill = rgbString(rgb)
      const latlng: L.LatLngExpression = [c.location.latitude, c.location.longitude]
      const cat = getAqiCategory(c.aqi)

      if (showHeat) L.circle(latlng, { radius: heatRadius, stroke: false, fillColor: fill, fillOpacity: 0.3, interactive: false }).addTo(group)

      const marker: L.Layer =
        zoom >= NUMBERS_FROM_ZOOM
          ? L.marker(latlng, {
              icon: L.divIcon({
                className: 'aqi-pin',
                iconSize: [36, 22],
                iconAnchor: [18, 11],
                html: `<div style="background:${fill};color:${readableOn(rgb)};border:1px solid rgba(255,255,255,.85);border-radius:9999px;font:600 11px/20px system-ui,sans-serif;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.35)">${c.aqi}</div>`,
              }),
              keyboard: false,
            })
          : L.circleMarker(latlng, { radius: 5.5, fillColor: fill, fillOpacity: 0.95, color: '#fff', weight: 1.2 })

      marker
        .bindTooltip(`<strong>${c.location.name}</strong><br>${c.location.region}<br>AQI ${c.aqi} · ${cat.label}`, { direction: 'top', offset: [0, -6] })
        .on('click', () => onPick.current(c.location))
        .addTo(group)

      if (c.location.id === location?.id) {
        L.circleMarker(latlng, { radius: 13, fill: false, color: resolved === 'dark' ? '#fff' : '#111', weight: 2, interactive: false }).addTo(group)
      }
    }
  }, [cities, colors, zoom, showHeat, location?.id, resolved])

  const ranked = useMemo(() => [...cities].sort((a, b) => b.aqi - a.aqi), [cities])
  const average = cities.length ? Math.round(cities.reduce((s, c) => s + c.aqi, 0) / cities.length) : 0

  const focusCity = (c: CityAqi) => {
    setLocation(c.location)
    mapRef.current?.flyTo([c.location.latitude, c.location.longitude], Math.max(mapRef.current.getZoom(), 7), { duration: 0.8 })
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Live India AQI map
            {status === 'success' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-aqi-good" />
                Live
              </span>
            )}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
            {status === 'success' && updatedAt
              ? `${cities.length} cities · average AQI ${average} · ${isRefreshing ? 'updating…' : `updated ${time(updatedAt)}`}`
              : 'Real-time AQI across India'}
          </p>
        </div>
        <Button variant="outline" size="sm" aria-pressed={showHeat} onClick={() => setShowHeat((v) => !v)}>
          <Flame aria-hidden className="size-4" />
          Heat layer
        </Button>
      </CardHeader>
      <CardContent className="grid gap-5 pt-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="relative isolate z-0 overflow-hidden rounded-xl border border-foreground/10">
            <div ref={containerRef} className="h-[24rem] w-full bg-muted sm:h-[30rem]" role="region" aria-label="Interactive map of India showing live AQI by city" />
            {status === 'loading' && <Skeleton className="absolute inset-0 z-[500] rounded-none" />}
            {status === 'error' && (
              <div className="absolute inset-0 z-[500] grid place-items-center bg-background/90 p-4">
                <ErrorState title="Map data unavailable" description="Please try again." onRetry={retry} className="border-0" />
              </div>
            )}
          </div>
          <div className="mt-3">
            <Legend gradient={gradient} />
            <p className="mt-2 text-xs text-muted-foreground">
              Click a city to switch to it. Drag to pan, use + / − or click the map and scroll to zoom. Zoom in to see each city’s AQI number.
            </p>
          </div>
        </div>

        <div className="grid content-start gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
          {status === 'success' && (
            <>
              <section aria-label="Most polluted cities">
                <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Most polluted</h3>
                <ul>{ranked.slice(0, 6).map((c) => <CityRow key={c.location.id} city={c} onSelect={focusCity} />)}</ul>
              </section>
              <section aria-label="Cleanest cities">
                <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Cleanest</h3>
                <ul>{ranked.slice(-6).reverse().map((c) => <CityRow key={c.location.id} city={c} onSelect={focusCity} />)}</ul>
              </section>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function IndiaAqiMapSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="grid gap-5 pt-3 lg:grid-cols-5">
        <Skeleton className="h-[24rem] lg:col-span-3" />
        <Skeleton className="h-[24rem] lg:col-span-2" />
      </CardContent>
    </Card>
  )
}
