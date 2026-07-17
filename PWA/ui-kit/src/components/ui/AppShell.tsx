import { type ReactNode, useState, useEffect } from 'react'
import { formatTime, formatDate } from '../../lib/utils'
import AlarmIcon from '../icons/AlarmIcon'
import NavDashboardIcon from '../icons/NavDashboardIcon'
import NavAlarmsIcon from '../icons/NavAlarmsIcon'
import NavSettingsIcon from '../icons/NavSettingsIcon'
import GatewayIcon from '../icons/GatewayIcon'
import RefreshCountdown from './RefreshCountdown'

interface NavItem {
  path: string
  label: string
  icon: ReactNode
}

interface Props {
  children: ReactNode
  currentPath: string
  alarmCount?: number
  siteName?: string
  userName?: string
  userRole?: string
  onNavigate?: (path: string) => void
  onRefresh?: () => void
}

// Inline nav icons for pages without a dedicated icon component
const TrendsIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
)
const ReportsIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>
)

// Human-readable role label
function roleLabel(role?: string): string {
  switch (role) {
    case 'JENIX_SUPER_ADMIN': return 'Super Admin'
    case 'VENDOR_ADMIN': return 'Vendor Admin'
    case 'CLIENT_ADMIN': return 'Client Admin'
    case 'MAINTENANCE_USER': return 'Maintenance'
    case 'VIEWER': return 'Viewer'
    default: return 'User'
  }
}

export default function AppShell({ children, currentPath, alarmCount = 0, siteName = 'ABC Towers', userName = 'Admin', userRole, onNavigate, onRefresh }: Props) {
  const [clock, setClock] = useState(new Date())
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const navItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: <NavDashboardIcon size={18} /> },
    { path: '/gateways', label: 'Gateways', icon: <GatewayIcon size={18} /> },
    { path: '/alarms', label: 'Alarms', icon: <NavAlarmsIcon size={18} /> },
    { path: '/trends', label: 'Trends', icon: <TrendsIcon size={18} /> },
    { path: '/reports', label: 'Reports', icon: <ReportsIcon size={18} /> },
    { path: '/settings', label: 'Settings', icon: <NavSettingsIcon size={18} /> },
  ]
  // Mobile bottom bar shows the 5 most-used destinations
  const mobileNav = navItems.filter(i => i.path !== '/reports')

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-60 bg-slate-900 text-slate-300 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2c0 4-4 6-3 10 1-1.5 2-4 5-4-1.5 3 0 6 1.5 7.5C15 13 18 12 17 8c-1 1.5-2.5 4-5 2C14 8 16 4 12 2z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">FireGuard</p>
            <p className="text-slate-500 text-[10px]">by Jenix</p>
          </div>
        </div>
        {/* Site selector */}
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Active Site</p>
          <button className="w-full flex items-center justify-between text-sm text-slate-200 bg-slate-800 px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors">
            <span className="truncate">{siteName}</span>
            <svg className="w-3 h-3 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const active = currentPath === item.path
            return (
              <button
                key={item.path}
                onClick={() => onNavigate?.(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.path === '/alarms' && alarmCount > 0 && (
                  <span className="ml-auto text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">{alarmCount}</span>
                )}
              </button>
            )
          })}
        </nav>
        {/* User */}
        <div className="px-4 py-4 border-t border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userName[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 font-medium truncate">{userName}</p>
            <p className="text-xs text-slate-500">{roleLabel(userRole)}</p>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100" onClick={() => setSidebarOpen(o => !o)}>
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">{formatDate(clock)}</p>
            <p className="text-sm font-semibold text-slate-800">{formatTime(clock)}</p>
          </div>
          <RefreshCountdown totalSeconds={30} onRefresh={onRefresh} />
          <AlarmIcon size={22} className="text-slate-500" badge={alarmCount} />
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer">
            {userName[0].toUpperCase()}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden border-t border-slate-200 bg-white flex">
          {mobileNav.map(item => {
            const active = currentPath === item.path
            return (
              <button
                key={item.path}
                onClick={() => onNavigate?.(item.path)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${active ? 'text-indigo-600' : 'text-slate-400'}`}
              >
                {item.icon}
                {item.label.split(' ')[0]}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
