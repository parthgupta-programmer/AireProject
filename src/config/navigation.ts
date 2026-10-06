import {
  Bell, BookOpen, HeartPulse, House, Route, Settings, TrendingUp, Wind,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  short: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Overview', short: 'Home', icon: House },
  { to: '/air-quality', label: 'Air Quality', short: 'Air', icon: Wind },
  { to: '/insights', label: 'Insights', short: 'Insights', icon: TrendingUp },
  { to: '/routes', label: 'Routes', short: 'Routes', icon: Route },
  { to: '/health', label: 'Health', short: 'Health', icon: HeartPulse },
  { to: '/alerts', label: 'Alerts', short: 'Alerts', icon: Bell },
  { to: '/learn', label: 'Learn', short: 'Learn', icon: BookOpen },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings },
]

export const settingsItem = navItems[navItems.length - 1]
export const primaryNav = navItems.slice(0, -1)
export const mobileTabPaths = ['/', '/air-quality', '/insights', '/routes']
