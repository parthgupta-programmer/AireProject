import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
<<<<<<< HEAD
import { AuthProvider } from '@/context/AuthContext'
import { LocationProvider } from '@/context/LocationContext'
import { AirQualityProvider } from '@/context/AirQualityContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import AuthPage from '@/pages/AuthPage'
=======
import { LocationProvider } from '@/context/LocationContext'
import { AirQualityProvider } from '@/context/AirQualityContext'
import { AppLayout } from '@/components/layout/AppLayout'
>>>>>>> 8d60260a0ed2de7066625ff80d84bcbd62a75af1
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

export default function App() {
  return (
    <ThemeProvider>
<<<<<<< HEAD
      <AuthProvider>
=======
>>>>>>> 8d60260a0ed2de7066625ff80d84bcbd62a75af1
      <LocationProvider>
      <AirQualityProvider>
      <BrowserRouter>
        <Routes>
<<<<<<< HEAD
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="signup" element={<AuthPage mode="signup" />} />
          <Route element={<RequireAuth />}>
=======
>>>>>>> 8d60260a0ed2de7066625ff80d84bcbd62a75af1
          <Route element={<AppLayout />}>
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
<<<<<<< HEAD
          </Route>
=======
>>>>>>> 8d60260a0ed2de7066625ff80d84bcbd62a75af1
        </Routes>
      </BrowserRouter>
      </AirQualityProvider>
      </LocationProvider>
<<<<<<< HEAD
      </AuthProvider>
=======
>>>>>>> 8d60260a0ed2de7066625ff80d84bcbd62a75af1
    </ThemeProvider>
  )
}
