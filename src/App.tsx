import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { LocationProvider } from '@/context/LocationContext'
import { AirQualityProvider } from '@/context/AirQualityContext'
import { AppLayout } from '@/components/layout/AppLayout'
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
      <LocationProvider>
      <AirQualityProvider>
      <BrowserRouter>
        <Routes>
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
        </Routes>
      </BrowserRouter>
      </AirQualityProvider>
      </LocationProvider>
    </ThemeProvider>
  )
}
