/**
 * Settings page — profile, subscription/site, notification preferences, and
 * (for CLIENT_ADMIN+) team member management. Reuses the approved kit.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import type { SubscriptionInfo, SubscriptionResponse } from '../lib/types'

import AppShell from '../components/ui/AppShell'
import SectionCard from '../components/ui/SectionCard'
import Button from '../components/ui/Button'
import Toggle from '../components/ui/Toggle'
import StatusBadge from '../components/ui/StatusBadge'
import type { Status } from '../lib/utils'

const ROLE_LABEL: Record<string, string> = {
  JENIX_SUPER_ADMIN: 'Super Admin',
  VENDOR_ADMIN: 'Vendor Admin',
  CLIENT_ADMIN: 'Admin',
  MAINTENANCE_USER: 'Member',
  VIEWER: 'Viewer',
}

const NOTIF_KEY = 'fg_notif_prefs'
interface NotifPrefs { push: boolean; email: boolean; sms: boolean; criticalOnly: boolean }
const defaultPrefs: NotifPrefs = { push: true, email: true, sms: true, criticalOnly: false }

function subStatus(s?: SubscriptionInfo['status']): Status {
  if (s === 'active' || s === 'trial') return 'ok'
  if (s === 'grace') return 'warning'
  if (s === 'expired') return 'critical'
  return 'idle'
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate()
  const { user, siteId, logout } = useAuth()

  const [sub, setSub] = useState<SubscriptionInfo | null>(null)
  const [prefs, setPrefs] = useState<NotifPrefs>(() => {
    try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(NOTIF_KEY) ?? '{}') } } catch { return defaultPrefs }
  })

  useEffect(() => {
    void api.get<SubscriptionResponse>('/subscription').then((r) => setSub(r.data.subscription)).catch(() => {})
  }, [])

  function setPref(key: keyof NotifPrefs, val: boolean) {
    const next = { ...prefs, [key]: val }
    setPrefs(next)
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next))
  }

  return (
    <AppShell
      currentPath="/settings"
      siteName={user?.name ?? 'FireGuard'}
      userName={user?.name ?? 'Admin'}
      userRole={user?.role}
      onNavigate={(path) => {
        if (path === '/logout') { logout(); return }
        navigate(path)
      }}
    >
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">Manage your account, subscription and team</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Profile */}
        <SectionCard title="Profile" accent="#6366F1">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
              {(user?.name ?? 'U')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800">{user?.name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Role</span>
              <span className="font-medium text-slate-800">{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Site ID</span>
              <span className="font-medium text-slate-800">{siteId ?? '—'}</span>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => logout()}>Sign out</Button>
        </SectionCard>

        {/* Subscription */}
        <SectionCard title="Subscription" accent="#22C55E">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-slate-500">Current plan</p>
              <p className="text-lg font-bold text-slate-800 capitalize">{sub?.status ?? '—'}</p>
            </div>
            <StatusBadge
              status={subStatus(sub?.status)}
              label={sub?.status === 'trial' ? 'Trial' : sub?.status === 'active' ? 'Active' : sub?.status === 'grace' ? 'Grace' : sub?.status === 'expired' ? 'Expired' : '—'}
            />
          </div>
          {sub?.daysLeft != null && (
            <p className="text-sm text-slate-600 mb-4">
              <strong>{sub.daysLeft} day{sub.daysLeft === 1 ? '' : 's'}</strong> remaining{sub.status === 'trial' ? ' in your free trial' : ''}.
            </p>
          )}
          <p className="text-xs text-slate-500 leading-relaxed">
            Billed per connected device, per year, after the free trial. To activate or renew, contact us and we'll
            set up your plan.
          </p>
          <a
            href="https://wa.me/917240226566"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg"
          >
            Contact us on WhatsApp →
          </a>
        </SectionCard>

        {/* Notifications */}
        <SectionCard title="Notifications" accent="#F59E0B">
          <p className="text-xs text-slate-400 mb-3">Alert channels for this account (saved on this device).</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-700">Push notifications</span><Toggle checked={prefs.push} onChange={(v) => setPref('push', v)} /></div>
            <div className="flex items-center justify-between"><span className="text-sm text-slate-700">Email alerts</span><Toggle checked={prefs.email} onChange={(v) => setPref('email', v)} /></div>
            <div className="flex items-center justify-between"><span className="text-sm text-slate-700">SMS alerts</span><Toggle checked={prefs.sms} onChange={(v) => setPref('sms', v)} /></div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-sm text-slate-700">Critical alarms only</span><Toggle checked={prefs.criticalOnly} onChange={(v) => setPref('criticalOnly', v)} /></div>
          </div>
        </SectionCard>

        {/* Team management moved to its own Users tab */}
        <SectionCard title="Team" accent="#7C3AED">
          <p className="text-sm text-slate-600 mb-3">Manage who can access this account and their roles.</p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/users')}>Manage users →</Button>
        </SectionCard>
      </div>
    </AppShell>
  )
}
