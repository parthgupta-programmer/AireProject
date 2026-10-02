import { Link } from 'react-router-dom'

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-md text-base font-semibold tracking-tight">
      <svg viewBox="0 0 24 24" className="size-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <circle cx="12" cy="12" r="8.5" strokeDasharray="42 12" strokeLinecap="round" />
      </svg>
      Aire
    </Link>
  )
}
