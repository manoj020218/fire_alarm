/**
 * Settings page — profile, subscription/site, notification preferences, and
 * (for CLIENT_ADMIN+) team member management. Reuses the approved kit.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import type { SubscriptionInfo, SubscriptionResponse, UserItem, UsersResponse } from '../lib/types'
import axios from 'axios'

import AppShell from '../components/ui/AppShell'
import SectionCard from '../components/ui/SectionCard'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Dropdown from '../components/ui/Dropdown'
import Toggle from '../components/ui/Toggle'
import StatusBadge from '../components/ui/StatusBadge'
import type { Status } from '../lib/utils'

const isAdmin = (role?: string) =>
  role === 'CLIENT_ADMIN' || role === 'VENDOR_ADMIN' || role === 'JENIX_SUPER_ADMIN'

const ROLE_LABEL: Record<string, string> = {
  JENIX_SUPER_ADMIN: 'Super Admin',
  VENDOR_ADMIN: 'Vendor Admin',
  CLIENT_ADMIN: 'Client Admin',
  MAINTENANCE_USER: 'Maintenance',
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

// ── Add-user modal ───────────────────────────────────────────────────────────
function AddUserModal({ siteId, onClose, onAdded }: { siteId: string | null; onClose: () => void; onAdded: (u: UserItem) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('VIEWER')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError('Enter a name, a valid email, and a password of at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      const res = await api.post<{ ok: boolean; user: UserItem }>('/users', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        siteIds: siteId ? [siteId] : [],
      })
      onAdded(res.data.user)
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : 'Could not create this user.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <h3 className="text-base font-bold text-slate-800 mb-4">Add team member</h3>
        <div className="space-y-3">
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Temporary password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <Dropdown
              options={[
                { value: 'VIEWER', label: 'Viewer — read only' },
                { value: 'MAINTENANCE_USER', label: 'Maintenance — acknowledge alarms' },
                { value: 'CLIENT_ADMIN', label: 'Client Admin — full access' },
              ]}
              value={role}
              onChange={setRole}
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</p>}
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" size="md" className="flex-1 justify-center" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" className="flex-1 justify-center" loading={busy} onClick={() => void submit()}>Create user</Button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate()
  const { user, siteId, logout } = useAuth()
  const admin = isAdmin(user?.role)

  const [sub, setSub] = useState<SubscriptionInfo | null>(null)
  const [prefs, setPrefs] = useState<NotifPrefs>(() => {
    try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(NOTIF_KEY) ?? '{}') } } catch { return defaultPrefs }
  })
  const [users, setUsers] = useState<UserItem[]>([])
  const [usersLoading, setUsersLoading] = useState(admin)
  const [showAddUser, setShowAddUser] = useState(false)

  useEffect(() => {
    void api.get<SubscriptionResponse>('/subscription').then((r) => setSub(r.data.subscription)).catch(() => {})
  }, [])

  const fetchUsers = useCallback(async () => {
    if (!admin) return
    try {
      const res = await api.get<UsersResponse>('/users', { params: siteId ? { siteId } : {} })
      setUsers(res.data.users)
    } catch {
      /* non-fatal */
    } finally {
      setUsersLoading(false)
    }
  }, [admin, siteId])

  useEffect(() => { void fetchUsers() }, [fetchUsers])

  function setPref(key: keyof NotifPrefs, val: boolean) {
    const next = { ...prefs, [key]: val }
    setPrefs(next)
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next))
  }

  async function removeUser(id: string) {
    if (!confirm('Remove this team member?')) return
    const prev = users
    setUsers((u) => u.filter((x) => (x._id ?? x.id) !== id))
    try {
      await api.delete(`/users/${id}`)
    } catch {
      setUsers(prev) // revert on failure
    }
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

        {/* Team (admins only) */}
        {admin && (
          <SectionCard
            title="Team members"
            accent="#7C3AED"
            action={<Button variant="primary" size="sm" onClick={() => setShowAddUser(true)}>+ Add</Button>}
          >
            {usersLoading ? (
              <div className="flex items-center justify-center h-24 text-sm text-slate-500">Loading…</div>
            ) : users.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No team members yet.</p>
            ) : (
              <div className="space-y-1">
                {users.map((u) => {
                  const uid = u._id ?? u.id ?? u.email
                  const isSelf = u.email === user?.email
                  return (
                    <div key={uid} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
                        {u.name[0]?.toUpperCase() ?? 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{u.name}{isSelf && <span className="text-xs text-slate-400"> (you)</span>}</p>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                      <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{ROLE_LABEL[u.role] ?? u.role}</span>
                      {!isSelf && (
                        <button onClick={() => void removeUser(uid)} className="text-slate-300 hover:text-red-500 transition-colors" title="Remove">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        )}
      </div>

      {showAddUser && (
        <AddUserModal
          siteId={siteId}
          onClose={() => setShowAddUser(false)}
          onAdded={(u) => { setShowAddUser(false); setUsers((prev) => [u, ...prev]) }}
        />
      )}
    </AppShell>
  )
}
