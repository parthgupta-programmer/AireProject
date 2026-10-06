import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Link2, LogIn, Moon, Search, Sun, UserPlus, type LucideIcon } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import { SECTIONS, useDialog, useLanding } from './context'

interface Command {
  id: string
  label: string
  icon: LucideIcon
  run: () => void
}

/** Ctrl / Cmd + K: jump to a section, log in, sign up, switch theme or copy the link. */
export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const { go, toast } = useLanding()
  const { resolved, setTheme } = useTheme()
  const reduce = useReducedMotion()
  const ref = useDialog(onClose)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listId = useId()
  const next = resolved === 'dark' ? 'light' : 'dark'

  const commands = useMemo<Command[]>(
    () => [
      ...SECTIONS.map<Command>((s) => ({
        id: `go-${s.id}`,
        label: `Go to ${s.label}`,
        icon: ArrowRight,
        run: () => document.getElementById(s.id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }),
      })),
      { id: 'login', label: 'Log in', icon: LogIn, run: () => go('/login') },
      { id: 'signup', label: 'Create an account', icon: UserPlus, run: () => go('/signup') },
      { id: 'theme', label: `Switch to ${next} mode`, icon: next === 'dark' ? Moon : Sun, run: () => setTheme(next) },
      {
        id: 'copy',
        label: 'Copy link to this page',
        icon: Link2,
        run: () =>
          navigator.clipboard
            ?.writeText(window.location.origin)
            .then(() => toast('Link copied'))
            .catch(() => toast('Could not copy the link')),
      },
    ],
    [go, toast, next, setTheme, reduce],
  )

  const results = commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()))
  const active = Math.min(index, Math.max(results.length - 1, 0))

  const choose = (cmd: Command | undefined) => {
    if (!cmd) return
    onClose()
    // wait for the dialog to finish closing so the page can scroll again
    window.setTimeout(cmd.run, 280)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((active + 1) % Math.max(results.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((active - 1 + results.length) % Math.max(results.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[active])
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[14vh] backdrop-blur-sm"
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        initial={{ opacity: 0, y: -16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="lp-glass w-full max-w-lg overflow-hidden rounded-2xl bg-card/90"
      >
        <div className="flex items-center gap-3 border-b px-4">
          <Search aria-hidden className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
            aria-label="Search commands"
            placeholder="Type a command or search…"
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-input px-1.5 text-[11px] text-muted-foreground">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Commands" className="max-h-72 overflow-y-auto p-2">
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${c.id}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(c)}
              className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm', i === active ? 'bg-accent text-accent-foreground' : 'text-foreground')}
            >
              <c.icon aria-hidden className="size-4 text-muted-foreground" />
              {c.label}
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</li>}
        </ul>
      </motion.div>
    </motion.div>
  )
}
