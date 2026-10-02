import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

import { Check, ChevronDown, Search } from 'lucide-react'

import { searchLocations } from '@/services/airQualityService'

import { Input } from '@/components/ui/input'

import { cn } from '@/lib/utils'

import type { LocationOption } from '@/types/airQuality'

interface Props {
  value: LocationOption | null
  onChange: (location: LocationOption) => void
}

export function LocationSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationOption[] | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelId = useId()

  const close = (returnFocus = false) => {
    setOpen(false)
    setQuery('')

    if (returnFocus) triggerRef.current?.focus()
  }

  // Search (mock service today, geocoding API later)
  useEffect(() => {
    if (!open) return

    let cancelled = false

    const timer = setTimeout(
      () => {
        searchLocations(query)
          .then((r) => !cancelled && setResults(r))
          .catch(() => !cancelled && setResults([]))
      },
      query ? 150 : 0,
    )

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, query])

  useEffect(() => {
    if (!open) return

    inputRef.current?.focus()

    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }

    document.addEventListener('mousedown', onDown)

    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const select = (l: LocationOption) => {
    onChange(l)
    close(true)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close(true)
      return
    }

    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return

    const items = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[data-nav]') ?? [],
    )

    const i = items.indexOf(document.activeElement as HTMLElement)

    e.preventDefault()

    items[
      e.key === 'ArrowDown'
        ? Math.min(i + 1, items.length - 1)
        : Math.max(i - 1, 0)
    ]?.focus()
  }

  return (
    <div
      ref={rootRef}
      className="relative -ml-2 w-fit max-w-full"
      onKeyDown={onKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Location: ${value?.name ?? 'none selected'}. Change location`}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-2xl font-semibold tracking-tight transition-colors hover:bg-accent"
      >
        <span className="truncate">
          {value?.name ?? 'Choose location'}
        </span>

        <ChevronDown
          aria-hidden
          className={cn(
            'size-5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose location"
          className="absolute left-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-page-in rounded-lg border bg-card p-2"
        >
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />

            <Input
              ref={inputRef}
              data-nav
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                results?.[0] &&
                select(results[0])
              }
              placeholder="Search a city, state or UT"
              aria-label="Search locations"
              className="pl-9"
            />
          </div>

          <ul className="mt-2 max-h-72 overflow-y-auto">
            {results === null && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Loading…
              </li>
            )}

            {results?.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No locations found
              </li>
            )}

            {results?.map((l, i) => {
              const selected = l.id === value?.id
              const newGroup =
                l.region !== results[i - 1]?.region

              return (
                <li key={l.id}>
                  {newGroup && (
                    <p className="sticky top-0 bg-card px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {l.region}
                      {l.regionType === 'Union Territory' && ' · UT'}
                    </p>
                  )}

                  <button
                    type="button"
                    data-nav
                    aria-current={selected || undefined}
                    onClick={() => select(l)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {l.name}
                      </span>

                      <span className="block truncate text-xs text-muted-foreground">
                        {[l.region, l.country]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </span>

                    {selected && (
                      <Check
                        aria-hidden
                        className="size-4 shrink-0 text-primary"
                      />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}