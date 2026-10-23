import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/** Wrap routes that need a signed-in user. Everyone else is sent to /login and brought back afterwards. */
export function RequireAuth() {
  const { user, initialising } = useAuth()
  const location = useLocation()

  // Wait for the backend session check to complete before making a routing decision.
  if (initialising) return null

  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />
}
