/**
 * RoutesPage.tsx
 * ──────────────
 * Phase 4: Pollution-aware route planning.
 *
 * Features:
 * - Location picker from the existing India locations database
 * - Nominatim free-text geocoding for custom addresses
 * - Origin / destination swap
 * - Travel mode selection (driving, cycling, walking)
 * - Real routes from OSRM (polyline geometry, distance, duration)
 * - Leaflet map with route polylines + origin/destination markers
 * - Pollution exposure estimation using Open-Meteo AQI samples
 * - Route comparison cards with clearly labelled data quality
 * - Full error, loading, no-route, and stale-data states
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowLeftRight,
  Bike,
  Car,
  ChevronDown,
  Clock,
  Info,
  Loader2,
  MapPin,
  Navigation,
  Route,
  RotateCw,
  Search,
  Footprints,
  Wind,
  ExternalLink,
  Layers,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useTheme } from '@/context/ThemeContext'
import { AQI_BG, getAqiCategory, type AqiKey } from '@/lib/aqi'
import { INDIA_LOCATIONS } from '@/data/indiaLocations'
import { cn } from '@/lib/utils'
import {
  fetchRoutes,
  geocodeQuery,
  formatDistance,
  formatDuration,
  identifyBestRoutes,
  locationToGeoPoint,
  buildGoogleMapsDirectionsUrl,
  RoutingServiceError,
  type GeoPoint,
  type GeocodingResult,
  type ParsedRoute,
  type TravelMode,
} from '@/services/routingService'
import type { LocationOption } from '@/types/airQuality'

// ── Constants ────────────────────────────────────────────────────────────────

const CARTO_KEY = (import.meta.env.VITE_CARTO_KEY as string | undefined)?.trim()
const BASEMAP = CARTO_KEY
  ? {
      url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    }
  : {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }
const DARK_TILE_FILTER = 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9)'

export type MapStyle = 'google_road' | 'google_satellite' | 'google_terrain' | 'osm'

interface MapStyleConfig {
  id: MapStyle
  label: string
  url: string
  subdomains?: string[]
  attribution: string
  maxZoom: number
}

const MAP_STYLES: Record<MapStyle, MapStyleConfig> = {
  google_road: {
    id: 'google_road',
    label: 'Google Map',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    attribution: '© Google Maps',
    maxZoom: 20,
  },
  google_satellite: {
    id: 'google_satellite',
    label: 'Satellite',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    attribution: '© Google Maps',
    maxZoom: 20,
  },
  google_terrain: {
    id: 'google_terrain',
    label: 'Terrain',
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    attribution: '© Google Maps',
    maxZoom: 20,
  },
  osm: {
    id: 'osm',
    label: 'OpenStreetMap',
    url: BASEMAP.url,
    attribution: BASEMAP.attribution,
    maxZoom: 19,
  },
}

const INDIA_LOCATIONS_SORTED = [...INDIA_LOCATIONS].sort((a, b) =>
  a.name.localeCompare(b.name),
)

const TRAVEL_MODES: { mode: TravelMode; label: string; icon: typeof Car }[] = [
  { mode: 'driving', label: 'Drive', icon: Car },
  { mode: 'cycling', label: 'Cycle', icon: Bike },
  { mode: 'walking', label: 'Walk', icon: Footprints },
]

/** AQI colour palette for polylines — matches the app's existing heat map. */
const ROUTE_COLORS = [
  'hsl(220 90% 58%)', // blue  - primary route
  'hsl(280 75% 60%)', // purple - alternative A
  'hsl(24  90% 52%)', // orange - alternative B
]

// ── Sub-components ────────────────────────────────────────────────────────────

interface LocationInputProps {
  id: string
  label: string
  icon: typeof MapPin
  value: string
  onTextChange: (v: string) => void
  suggestions: GeocodingResult[]
  loadingSuggestions: boolean
  onSelectSuggestion: (g: GeocodingResult) => void
  onSelectLocation: (l: LocationOption) => void
  quickPick: boolean
  onToggleQuickPick: () => void
  disabled?: boolean
}

function LocationInput({
  id,
  label,
  icon: Icon,
  value,
  onTextChange,
  suggestions,
  loadingSuggestions,
  onSelectSuggestion,
  onSelectLocation,
  quickPick,
  onToggleQuickPick,
  disabled,
}: LocationInputProps) {
  const dropId = `${id}-drop`

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="mr-1 inline size-3" aria-hidden />
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            type="text"
            value={value}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onTextChange(e.target.value)}
            placeholder={`City, address, or landmark in India`}
            disabled={disabled}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={suggestions.length > 0 ? dropId : undefined}
            className="pr-9"
          />
          {loadingSuggestions && (
            <Loader2
              aria-hidden
              className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          )}
          {suggestions.length > 0 && (
            <ul
              id={dropId}
              role="listbox"
              aria-label={`${label} suggestions`}
              className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-foreground/10 bg-card shadow-xl"
            >
              {suggestions.map((s, i) => (
                <li key={i} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => onSelectSuggestion(s)}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                  >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <div>
                      <div className="font-medium leading-snug">{s.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{s.displayName}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Pick from known locations"
          aria-pressed={quickPick}
          onClick={onToggleQuickPick}
          disabled={disabled}
          className="shrink-0"
        >
          <ChevronDown className={cn('size-4 transition-transform', quickPick && 'rotate-180')} aria-hidden />
        </Button>
      </div>

      {/* Quick-pick dropdown from India locations database */}
      {quickPick && (
        <div className="absolute left-0 top-full z-40 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-foreground/10 bg-card shadow-xl">
          {INDIA_LOCATIONS_SORTED.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => {
                onSelectLocation(loc)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="flex-1 truncate font-medium">{loc.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{loc.region}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Exposure Badge ────────────────────────────────────────────────────────────

function ExposureBadge({ index, coverage }: { index: number | null; coverage: number }) {
  if (index === null || coverage < 0.1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Info className="size-3" aria-hidden />
        AQI data unavailable
      </span>
    )
  }
  const aqi = Math.round(index / 10) // rough representative for badge colour
  const cat = getAqiCategory(aqi)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white',
        AQI_BG[cat.key as AqiKey],
      )}
    >
      <Wind className="size-3" aria-hidden />
      Exposure {index}
    </span>
  )
}

// ── Route Card ────────────────────────────────────────────────────────────────

interface RouteCardProps {
  route: ParsedRoute
  selected: boolean
  badges: { fastest?: boolean; shortest?: boolean; cleanest?: boolean }
  onClick: () => void
  origin: GeoPoint | null
  destination: GeoPoint | null
  mode: TravelMode
}

function RouteCard({
  route,
  selected,
  badges,
  onClick,
  origin,
  destination,
  mode,
}: RouteCardProps) {
  const { exposure } = route
  const dataAge =
    exposure.oldestObservation
      ? (() => {
          const diffMs = Date.now() - new Date(exposure.oldestObservation).getTime()
          const mins = Math.round(diffMs / 60_000)
          return mins < 120 ? `${mins} min ago` : `${Math.round(mins / 60)}h ago`
        })()
      : null

  const googleMapsUrl =
    origin && destination
      ? buildGoogleMapsDirectionsUrl(origin, destination, mode, route)
      : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      aria-pressed={selected}
      className={cn(
        'w-full cursor-pointer rounded-2xl border p-4 text-left transition-all',
        selected
          ? 'border-primary bg-primary/5 shadow-md'
          : 'border-foreground/10 bg-card hover:border-primary/40 hover:bg-accent/40',
      )}
    >
      {/* Header row */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="font-display text-sm font-semibold">{route.label}</span>
        {badges.fastest && (
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
            ⚡ Fastest
          </span>
        )}
        {badges.shortest && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
            📏 Shortest
          </span>
        )}
        {badges.cleanest && (
          <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-600">
            🍃 Lower exposure
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <Navigation className="size-3.5 text-muted-foreground" aria-hidden />
          <strong>{formatDistance(route.distanceM)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-muted-foreground" aria-hidden />
          <strong>{formatDuration(route.durationS)}</strong>
        </span>
      </div>

      {/* Exposure row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <ExposureBadge index={exposure.exposureIndex} coverage={exposure.coverageFraction} />
        {exposure.meanAqi !== null && (
          <span className="text-xs text-muted-foreground">
            Mean AQI {exposure.meanAqi}
          </span>
        )}
        {dataAge && (
          <span className="text-xs text-muted-foreground">· data {dataAge}</span>
        )}
        {exposure.coverageFraction < 1 && exposure.totalPoints > 0 && (
          <span className="text-xs text-muted-foreground">
            · {Math.round(exposure.coverageFraction * 100)}% coverage
          </span>
        )}
      </div>

      {/* Direct Google Maps Direction Link */}
      {googleMapsUrl && (
        <div className="mt-3 flex items-center justify-between border-t border-foreground/10 pt-2.5">
          <span className="text-xs font-medium text-muted-foreground">Live GPS route</span>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            title="Open directions in Google Maps"
          >
            <Navigation className="size-3" aria-hidden />
            <span>Give directions</span>
            <ExternalLink className="size-3 opacity-75" aria-hidden />
          </a>
        </div>
      )}
    </div>
  )
}

// ── Map Component ─────────────────────────────────────────────────────────────

interface RouteMapProps {
  origin: GeoPoint | null
  destination: GeoPoint | null
  routes: ParsedRoute[]
  selectedIndex: number
  mode?: TravelMode
  className?: string
}

function RouteMap({ origin, destination, routes, selectedIndex, mode = 'driving', className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const { resolved } = useTheme()
  const [mapStyle, setMapStyle] = useState<MapStyle>('google_road')

  // Create map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      minZoom: 4,
      maxZoom: 20,
      scrollWheelZoom: false,
    })
    map.on('focus click', () => map.scrollWheelZoom.enable())
    map.on('blur', () => map.scrollWheelZoom.disable())
    // Default view: India centre
    map.setView([22, 80], 5)

    routeLayerRef.current = L.layerGroup().addTo(map)
    markerLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      tileRef.current = null
      routeLayerRef.current = null
      markerLayerRef.current = null
    }
  }, [])

  // Tile layer dynamically switches based on chosen map style & theme
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (tileRef.current) {
      map.removeLayer(tileRef.current)
    }

    const cfg = MAP_STYLES[mapStyle]
    tileRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      subdomains: cfg.subdomains ?? ['a', 'b', 'c'],
      maxZoom: cfg.maxZoom,
    }).addTo(map)

    const pane = map.getPane('tilePane')
    if (pane) {
      // Only apply dark inversion to standard OSM; keep Google Maps crisp and authentic
      pane.style.filter = mapStyle === 'osm' && resolved === 'dark' ? DARK_TILE_FILTER : ''
    }
  }, [mapStyle, resolved])

  // Draw routes
  useEffect(() => {
    const rl = routeLayerRef.current
    if (!rl) return
    rl.clearLayers()

    routes.forEach((route, i) => {
      const isSelected = i === selectedIndex
      const color = ROUTE_COLORS[i] ?? '#888'
      const latlngs = route.geometry.map(([lat, lng]) => [lat, lng] as L.LatLngTuple)

      // Unselected routes drawn thinner underneath
      if (!isSelected) {
        L.polyline(latlngs, {
          color,
          weight: 4,
          opacity: 0.45,
          interactive: false,
        }).addTo(rl)
      } else {
        // Halo for selected
        L.polyline(latlngs, {
          color: 'white',
          weight: 8,
          opacity: 0.7,
          interactive: false,
        }).addTo(rl)
        L.polyline(latlngs, {
          color,
          weight: 5,
          opacity: 0.95,
          interactive: false,
        })
          .bindTooltip(
            `${route.label} · ${formatDistance(route.distanceM)} · ${formatDuration(route.durationS)}`,
            { sticky: true },
          )
          .addTo(rl)
      }
    })
  }, [routes, selectedIndex])

  // Draw markers and fit bounds
  useEffect(() => {
    const ml = markerLayerRef.current
    const map = mapRef.current
    if (!ml || !map) return
    ml.clearLayers()

    const pinStyle = (color: string, letter: string) =>
      L.divIcon({
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);display:grid;place-items:center">
          <span style="transform:rotate(45deg);font:bold 11px/1 system-ui,sans-serif;color:white">${letter}</span>
        </div>`,
      })

    const bounds: L.LatLng[] = []

    if (origin) {
      L.marker([origin.lat, origin.lng], {
        icon: pinStyle('hsl(220 90% 55%)', 'A'),
      })
        .bindTooltip('Origin', { permanent: false })
        .addTo(ml)
      bounds.push(L.latLng(origin.lat, origin.lng))
    }

    if (destination) {
      L.marker([destination.lat, destination.lng], {
        icon: pinStyle('hsl(4 90% 55%)', 'B'),
      })
        .bindTooltip('Destination', { permanent: false })
        .addTo(ml)
      bounds.push(L.latLng(destination.lat, destination.lng))
    }

    if (routes.length > 0) {
      routes[selectedIndex]?.geometry.forEach(([lat, lng]) =>
        bounds.push(L.latLng(lat, lng)),
      )
    }

    if (bounds.length >= 2) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 15 })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 12)
    }
  }, [origin, destination, routes, selectedIndex])

  const activeRoute = routes[selectedIndex]
  const gMapsUrl =
    origin && destination && activeRoute
      ? buildGoogleMapsDirectionsUrl(origin, destination, mode, activeRoute)
      : null

  return (
    <div
      className={cn(
        'relative isolate z-0 overflow-hidden rounded-2xl border border-foreground/10 shadow-sm',
        className,
      )}
    >
      {/* Map style selector overlay (top-right) */}
      <div className="absolute right-3 top-3 z-[1000] flex items-center gap-1 rounded-xl border border-foreground/15 bg-background/90 p-1 shadow-md backdrop-blur-md">
        <Layers className="ml-1 size-3 text-muted-foreground" aria-hidden />
        {(['google_road', 'google_satellite', 'google_terrain', 'osm'] as const).map((styleKey) => (
          <button
            key={styleKey}
            type="button"
            onClick={() => setMapStyle(styleKey)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
              mapStyle === styleKey
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {MAP_STYLES[styleKey].label}
          </button>
        ))}
      </div>

      {/* Direct Google Maps give directions floating link (top-left) */}
      {gMapsUrl && (
        <a
          href={gMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-xl border border-primary/25 bg-background/95 px-3 py-1.5 text-xs font-semibold text-primary shadow-md backdrop-blur-md transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-lg"
          title="Open live navigation in Google Maps"
        >
          <Navigation className="size-3.5" aria-hidden />
          <span>Give directions in Google Maps</span>
          <ExternalLink className="size-3 opacity-75" aria-hidden />
        </a>
      )}

      <div
        ref={containerRef}
        className="h-[22rem] w-full bg-muted sm:h-[30rem]"
        role="region"
        aria-label="Route map"
      />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type PageState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; routes: ParsedRoute[] }
  | { kind: 'error'; message: string }

export default function RoutesPage() {
  // ── Form state ──
  const [originText, setOriginText] = useState('')
  const [destText, setDestText] = useState('')
  const [originPoint, setOriginPoint] = useState<GeoPoint | null>(null)
  const [destPoint, setDestPoint] = useState<GeoPoint | null>(null)
  const [originLabel, setOriginLabel] = useState('')
  const [destLabel, setDestLabel] = useState('')
  const [mode, setMode] = useState<TravelMode>('driving')

  // ── Geocoding suggestions ──
  const [originSuggestions, setOriginSuggestions] = useState<GeocodingResult[]>([])
  const [destSuggestions, setDestSuggestions] = useState<GeocodingResult[]>([])
  const [originLoadingSug, setOriginLoadingSug] = useState(false)
  const [destLoadingSug, setDestLoadingSug] = useState(false)

  // ── Quick-pick dropdowns ──
  const [originQuickPick, setOriginQuickPick] = useState(false)
  const [destQuickPick, setDestQuickPick] = useState(false)

  // ── Route results ──
  const [pageState, setPageState] = useState<PageState>({ kind: 'idle' })
  const [selectedIndex, setSelectedIndex] = useState(0)

  // ── Debounced geocoding for origin ──
  useEffect(() => {
    const q = originText.trim()
    if (q.length < 3) {
      setOriginSuggestions([])
      return
    }
    setOriginLoadingSug(true)
    const t = setTimeout(async () => {
      try {
        const res = await geocodeQuery(q)
        setOriginSuggestions(res)
      } catch {
        setOriginSuggestions([])
      } finally {
        setOriginLoadingSug(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [originText])

  // ── Debounced geocoding for destination ──
  useEffect(() => {
    const q = destText.trim()
    if (q.length < 3) {
      setDestSuggestions([])
      return
    }
    setDestLoadingSug(true)
    const t = setTimeout(async () => {
      try {
        const res = await geocodeQuery(q)
        setDestSuggestions(res)
      } catch {
        setDestSuggestions([])
      } finally {
        setDestLoadingSug(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [destText])

  const selectOriginSuggestion = useCallback((g: GeocodingResult) => {
    setOriginPoint({ lat: g.lat, lng: g.lng })
    setOriginLabel(g.name)
    setOriginText(g.name)
    setOriginSuggestions([])
    setOriginQuickPick(false)
  }, [])

  const selectDestSuggestion = useCallback((g: GeocodingResult) => {
    setDestPoint({ lat: g.lat, lng: g.lng })
    setDestLabel(g.name)
    setDestText(g.name)
    setDestSuggestions([])
    setDestQuickPick(false)
  }, [])

  const selectOriginLocation = useCallback((loc: LocationOption) => {
    const pt = locationToGeoPoint(loc)
    setOriginPoint(pt)
    setOriginLabel(loc.name)
    setOriginText(loc.name)
    setOriginSuggestions([])
    setOriginQuickPick(false)
  }, [])

  const selectDestLocation = useCallback((loc: LocationOption) => {
    const pt = locationToGeoPoint(loc)
    setDestPoint(pt)
    setDestLabel(loc.name)
    setDestText(loc.name)
    setDestSuggestions([])
    setDestQuickPick(false)
  }, [])

  const swapOriginDest = useCallback(() => {
    setOriginText(destText)
    setDestText(originText)
    setOriginPoint(destPoint)
    setDestPoint(originPoint)
    setOriginLabel(destLabel)
    setDestLabel(originLabel)
    setOriginSuggestions([])
    setDestSuggestions([])
  }, [originText, destText, originPoint, destPoint, originLabel, destLabel])

  const handleSearch = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!originPoint || !destPoint) return

      setPageState({ kind: 'loading' })
      setSelectedIndex(0)
      setOriginSuggestions([])
      setDestSuggestions([])

      try {
        const routes = await fetchRoutes(originPoint, destPoint, mode)
        setPageState({ kind: 'success', routes })
      } catch (err) {
        const msg =
          err instanceof RoutingServiceError
            ? err.message
            : 'An unexpected error occurred. Please try again.'
        setPageState({ kind: 'error', message: msg })
      }
    },
    [originPoint, destPoint, mode],
  )

  const clearAll = useCallback(() => {
    setOriginText('')
    setDestText('')
    setOriginPoint(null)
    setDestPoint(null)
    setOriginLabel('')
    setDestLabel('')
    setOriginSuggestions([])
    setDestSuggestions([])
    setPageState({ kind: 'idle' })
    setSelectedIndex(0)
  }, [])

  const routes = pageState.kind === 'success' ? pageState.routes : []
  const best = useMemo(() => identifyBestRoutes(routes), [routes])
  const canSearch = Boolean(originPoint && destPoint)

  return (
    <>
      <PageHeader
        title="Route Planner"
        description="Compare travel time, distance, and estimated pollution exposure."
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* ── Left panel: search form + route cards ── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <form onSubmit={handleSearch} noValidate>
                {/* Origin */}
                <LocationInput
                  id="route-origin"
                  label="Origin"
                  icon={MapPin}
                  value={originText}
                  onTextChange={(v) => {
                    setOriginText(v)
                    if (v !== originLabel) setOriginPoint(null)
                  }}
                  suggestions={originSuggestions}
                  loadingSuggestions={originLoadingSug}
                  onSelectSuggestion={selectOriginSuggestion}
                  onSelectLocation={selectOriginLocation}
                  quickPick={originQuickPick}
                  onToggleQuickPick={() => {
                    setOriginQuickPick((v) => !v)
                    setDestQuickPick(false)
                  }}
                  disabled={pageState.kind === 'loading'}
                />

                {/* Swap button */}
                <div className="my-1 flex items-center">
                  <div className="h-px flex-1 bg-border" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Swap origin and destination"
                    onClick={swapOriginDest}
                    disabled={pageState.kind === 'loading'}
                    className="mx-2 size-8 rounded-full"
                  >
                    <ArrowLeftRight className="size-4" aria-hidden />
                  </Button>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Destination */}
                <LocationInput
                  id="route-destination"
                  label="Destination"
                  icon={Navigation}
                  value={destText}
                  onTextChange={(v) => {
                    setDestText(v)
                    if (v !== destLabel) setDestPoint(null)
                  }}
                  suggestions={destSuggestions}
                  loadingSuggestions={destLoadingSug}
                  onSelectSuggestion={selectDestSuggestion}
                  onSelectLocation={selectDestLocation}
                  quickPick={destQuickPick}
                  onToggleQuickPick={() => {
                    setDestQuickPick((v) => !v)
                    setOriginQuickPick(false)
                  }}
                  disabled={pageState.kind === 'loading'}
                />

                {/* Travel mode */}
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Travel mode
                  </p>
                  <div role="radiogroup" aria-label="Travel mode" className="flex gap-2">
                    {TRAVEL_MODES.map(({ mode: m, label, icon: Icon }) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={mode === m}
                        onClick={() => setMode(m)}
                        disabled={pageState.kind === 'loading'}
                        className={cn(
                          'flex flex-1 flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors',
                          mode === m
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-foreground/10 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                        {label}
                      </button>
                    ))}
                  </div>
                  {mode !== 'driving' && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <Info className="mr-1 inline size-3" aria-hidden />
                      OSRM returns one route for {mode}. Alternatives are only available for driving.
                    </p>
                  )}
                </div>

                {/* Validation hint */}
                {(originText && !originPoint) && (
                  <p className="mt-2 text-xs text-amber-600">
                    Select a suggestion or choose from the list for Origin.
                  </p>
                )}
                {(destText && !destPoint) && (
                  <p className="mt-1 text-xs text-amber-600">
                    Select a suggestion or choose from the list for Destination.
                  </p>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex gap-2">
                  <Button
                    type="submit"
                    size="md"
                    className="flex-1"
                    disabled={!canSearch || pageState.kind === 'loading'}
                    aria-disabled={!canSearch}
                  >
                    {pageState.kind === 'loading' ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Search className="size-4" aria-hidden />
                    )}
                    {pageState.kind === 'loading' ? 'Searching…' : 'Find routes'}
                  </Button>
                  {(originText || destText || routes.length > 0) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={clearAll}
                      disabled={pageState.kind === 'loading'}
                      aria-label="Clear all inputs"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* ── Route comparison cards ── */}
          {pageState.kind === 'loading' && (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          )}

          {pageState.kind === 'error' && (
            <ErrorState
              title="Could not find routes"
              description={pageState.message}
              onRetry={() => {
                if (originPoint && destPoint) {
                  setPageState({ kind: 'idle' })
                }
              }}
            />
          )}

          {pageState.kind === 'success' && routes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold">
                  {routes.length} route{routes.length > 1 ? 's' : ''} found
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSearch({ preventDefault: () => {} } as FormEvent)}
                  aria-label="Refresh routes"
                >
                  <RotateCw className="size-3.5" aria-hidden />
                  Refresh
                </Button>
              </div>

              {routes.map((route, i) => (
                <RouteCard
                  key={i}
                  route={route}
                  selected={selectedIndex === i}
                  badges={{
                    fastest: best.fastest === i,
                    shortest: best.shortest === i,
                    cleanest: best.cleanest === i,
                  }}
                  onClick={() => setSelectedIndex(i)}
                  origin={originPoint}
                  destination={destPoint}
                  mode={mode}
                />
              ))}

              {/* Disclaimer */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-3 text-xs text-amber-700 dark:text-amber-400">
                <Info className="mr-1 inline size-3" aria-hidden />
                <strong>Exposure estimates are indicative only.</strong> AQI data from Open-Meteo
                represents atmospheric model values at each sampled point. Actual personal
                exposure depends on ventilation, time of day, and other factors.
                This is not a medical measurement.
              </div>
            </div>
          )}

          {/* ── Idle empty state ── */}
          {pageState.kind === 'idle' && (
            <div className="rounded-2xl border border-dashed border-foreground/15 px-6 py-10 text-center">
              <Route className="mx-auto mb-3 size-8 text-muted-foreground/50" aria-hidden />
              <p className="font-display text-sm font-medium text-muted-foreground">
                Enter an origin and destination to compare routes.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Routes are sourced from OSRM. AQI data uses Open-Meteo — no API key needed.
              </p>
            </div>
          )}
        </div>

        {/* ── Right panel: map ── */}
        <div className="space-y-4">
          <RouteMap
            origin={originPoint}
            destination={destPoint}
            routes={routes}
            selectedIndex={selectedIndex}
            mode={mode}
            className="sticky top-4"
          />

          {/* Selected route details */}
          {routes.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">
                  {routes[selectedIndex]?.label ?? 'Route'} details
                </CardTitle>
                {originPoint && destPoint && routes[selectedIndex] && (
                  <a
                    href={buildGoogleMapsDirectionsUrl(
                      originPoint,
                      destPoint,
                      mode,
                      routes[selectedIndex],
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                    title="Open live navigation in Google Maps"
                  >
                    <Navigation className="size-3.5" aria-hidden />
                    <span>Give directions</span>
                    <ExternalLink className="size-3 opacity-75" aria-hidden />
                  </a>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {(() => {
                  const r = routes[selectedIndex]
                  if (!r) return null
                  const { exposure } = r
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatCell label="Distance" value={formatDistance(r.distanceM)} />
                        <StatCell label="Duration" value={formatDuration(r.durationS)} />
                        <StatCell
                          label="Mean AQI"
                          value={exposure.meanAqi !== null ? String(exposure.meanAqi) : 'N/A'}
                        />
                        <StatCell
                          label="Exposure index"
                          value={exposure.exposureIndex !== null ? String(exposure.exposureIndex) : 'N/A'}
                        />
                      </div>
                      <div className="rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                        <strong>Data quality:</strong>{' '}
                        {exposure.coveredPoints}/{exposure.totalPoints} sample points ({Math.round(exposure.coverageFraction * 100)}% coverage)
                        {exposure.oldestObservation && ` · Oldest reading: ${new Date(exposure.oldestObservation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        {exposure.coverageFraction < 0.5 && exposure.totalPoints > 0 && (
                          <> · <span className="text-amber-600 dark:text-amber-400">Low coverage — exposure index not shown.</span></>
                        )}
                      </div>
                      {originPoint && destPoint && (
                        <div className="pt-1">
                          <a
                            href={buildGoogleMapsDirectionsUrl(originPoint, destPoint, mode, r)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow"
                          >
                            <Navigation className="size-4" aria-hidden />
                            <span>Give directions in Google Maps ({r.label})</span>
                            <ExternalLink className="size-3.5 opacity-80" aria-hidden />
                          </a>
                        </div>
                      )}
                    </>
                  )
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold leading-tight">{value}</p>
    </div>
  )
}
