import { useEffect, useState } from 'react'

/** Current time, refreshed on an interval. Keeps "2 min ago" labels honest without a re-fetch. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
