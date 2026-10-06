import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AQI_BG } from '@/lib/aqi'
import { getPollutantFraction, getPollutantLevel, type PollutantMeta } from '@/lib/pollutants'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { cn } from '@/lib/utils'

interface Props {
  meta: PollutantMeta
  value?: number
  open: boolean
  onToggle: () => void
}

export function PollutantItem({ meta, value, open, onToggle }: Props) {
  const has = value !== undefined
  const level = has ? getPollutantLevel(meta, value) : null
  const panelId = `pollutant-${meta.key}`

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-md py-3 text-left"
      >
        <span className="w-14 shrink-0 text-sm font-medium">{meta.label}</span>
        <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          {level && (
            <span
              className={cn('block h-full rounded-full transition-[width,background-color] duration-700 ease-out', AQI_BG[level.key])}
              style={{ width: `${Math.max(getPollutantFraction(meta, value!) * 100, 4)}%` }}
            />
          )}
        </span>
        <span className="w-[6.5rem] shrink-0 text-right text-sm">
          {has ? (
            <>
              <AnimatedNumber value={value} decimals={meta.decimals} className="font-medium" />{' '}
              <span className="text-xs text-muted-foreground">{meta.unit}</span>
              <span className="sr-only">, {level!.label}</span>
            </>
          ) : (
            <>
              <span className="text-muted-foreground" aria-hidden>—</span>
              <span className="sr-only">Not available</span>
            </>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      <div
        id={panelId}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <p className="pb-3 text-sm text-muted-foreground">
            {level && <span className="font-medium text-foreground">{level.label}. </span>}
            {meta.description}{' '}
            <Link to="/learn" className="whitespace-nowrap text-primary underline-offset-2 hover:underline">
              Learn more
            </Link>
          </p>
        </div>
      </div>
    </li>
  )
}
