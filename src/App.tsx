import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { LocationProvider } from '@/context/LocationContext'
import { AirQualityProvider } from '@/context/AirQualityContext'
import { AppLayout } from '@/components/layout/AppLayout'
import AuthPage from '@/pages/AuthPage'
import HomePage from '@/pages/HomePage'
import AirQualityPage from '@/pages/AirQualityPage'
import InsightsPage from '@/pages/InsightsPage'
import RoutesPage from '@/pages/RoutesPage'
import HealthPage from '@/pages/HealthPage'
import AlertsPage from '@/pages/AlertsPage'
import LearnPage from '@/pages/LearnPage'
import SettingsPage from '@/pages/SettingsPage'
import DesignSystemPage from '@/pages/DesignSystemPage'
import NotFoundPage from '@/pages/NotFoundPage'

// The landing page (and its animation code) is downloaded only for visitors who are not logged in.
const LandingPage = lazy(() => import('@/pages/LandingPage'))

/** Logged in: the app. Logged out: the landing page at "/", and the login page for every other app address. */
function AppGate() {
  const { user } = useAuth()
  const location = useLocation()
  if (user) return <AppLayout />
  if (location.pathname === '/') {
    return (
      <Suspense fallback={<div className="min-h-dvh bg-background" />}>
        <LandingPage />
      </Suspense>
    )
  }
  return <Navigate to="/login" replace state={{ from: location.pathname }} />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocationProvider>
          <AirQualityProvider>
            <BrowserRouter>
              <Routes>
                <Route path="login" element={<AuthPage mode="login" />} />
                <Route path="signup" element={<AuthPage mode="signup" />} />

                <Route path="/" element={<AppGate />}>
                    <Route index element={<HomePage />} />
                    <Route path="air-quality" element={<AirQualityPage />} />
                    <Route path="insights" element={<InsightsPage />} />
                    <Route path="routes" element={<RoutesPage />} />
                    <Route path="health" element={<HealthPage />} />
                    <Route path="alerts" element={<AlertsPage />} />
                    <Route path="learn" element={<LearnPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="design" element={<DesignSystemPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AirQualityProvider>
        </LocationProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}