import { Link } from 'react-router-dom'

export function Logo() {
  return (
    <Link to="/" className="font-display flex items-center gap-2 rounded-full text-lg font-semibold">
      <svg viewBox="0 0 24 24" className="size-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <circle cx="12" cy="12" r="8.5" strokeDasharray="42 12" strokeLinecap="round" />
      </svg>
      Aire
    </Link>
  )
}
