/**
 * Users page — team access management (moved out of Settings into its own tab).
 * Admins add members with a role + generated password; Members (MAINTENANCE_USER)
 * can view + acknowledge alarms but cannot create users or add gateways (enforced
 * server-side: /users and /gateways/claim require CLIENT_ADMIN).
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import type { UserItem, UsersResponse } from '../lib/types'
import axios from 'axios'

import AppShell from '../components/ui/AppShell'
import SectionCard from '../components/ui/SectionCard'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Dropdown from '../components/ui/Dropdown'

const isAdmin = (role?: string) =>
  role === 'CLIENT_ADMIN' || role === 'VENDOR_ADMIN' || role === 'JENIX_SUPER_ADMIN'

// Friendly role labels (Admin / Member framing) for the customer.
const ROLE_LABEL: Record<string, string> = {
  JENIX_SUPER_ADMIN: 'Super Admin',
  VENDOR_ADMIN: 'Vendor Admin',
  CLIENT_ADMIN: 'Admin',
  MAINTENANCE_USER: 'Member',
  VIEWER: 'Viewer',
}
const ROLE_BADGE: Record<string, string> = {
  CLIENT_ADMIN: 'bg-indigo-100 text-indigo-700',
  MAINTENANCE_USER: 'bg-emerald-100 text-emerald-700',
  VIEWER: 'bg-slate-100 text-slate-600',
  VENDOR_ADMIN: 'bg-amber-100 text-amber-700',
  JENIX_SUPER_ADMIN: 'bg-red-100 text-red-700',
}

function generatePassword(): string {
  // Unambiguous, strong enough to share once. Guarantees length >= 8.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%'
  let p = ''
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p
}

interface Created { name: string; email: string; password: string }

// ── Add-member modal ─────────────────────────────────────────────────────────
function AddMemberModal({
  siteId,
  onClose,
  onAdded,
}: {
  siteId: string | null
  onClose: () => void
  onAdded: (u: UserItem, creds: Created) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => generatePassword())
  const [role, setRole] = useState('MAINTENANCE_USER')
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
      onAdded(res.data.user, { name: name.trim(), email: email.trim().toLowerCase(), password })
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : 'Could not create this member.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <h3 className="text-base font-bold text-slate-800 mb-1">Add member</h3>
        <p className="text-xs text-slate-500 mb-4">They'll sign in with this email and password (or Google, if it's a Google account).</p>
        <div className="space-y-3">
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <div className="flex gap-2">
              <Input className="flex-1" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button variant="secondary" size="md" onClick={() => setPassword(generatePassword())}>Generate</Button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Share this with the member — they can change it later.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <Dropdown
              options={[
                { value: 'MAINTENANCE_USER', label: 'Member — view & acknowledge alarms' },
                { value: 'CLIENT_ADMIN', label: 'Admin — full access (manage users & gateways)' },
                { value: 'VIEWER', label: 'Viewer — read only' },
              ]}
              value={role}
              onChange={setRole}
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</p>}
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" size="md" className="flex-1 justify-center" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" className="flex-1 justify-center" loading={busy} onClick={() => void submit()}>Add member</Button>
        </div>
      </div>
    </div>
  )
}

// ── Credentials panel (shown once, after creating a member) ───────────────────
function CredentialsCard({ creds, onDone }: { creds: Created; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const appUrl = `${window.location.origin}/app`
  const text = `FireGuard login\nURL: ${appUrl}\nEmail: ${creds.email}\nPassword: ${creds.password}`
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">Credentials for {creds.name}</h3>
        <p className="text-sm text-slate-500 mb-4">Share these with the member — this password won't be shown again.</p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-medium text-slate-800">{creds.email}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Password</span><span className="font-mono font-medium text-slate-800">{creds.password}</span></div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" size="md" className="flex-1 justify-center" onClick={() => void copy()}>{copied ? 'Copied ✓' : 'Copy details'}</Button>
          <Button variant="primary" size="md" className="flex-1 justify-center" onClick={onDone}>Done</Button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Users() {
  const navigate = useNavigate()
  const { user, siteId, logout } = useAuth()
  const admin = isAdmin(user?.role)

  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(admin)
  const [showAdd, setShowAdd] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!admin) return
    try {
      const res = await api.get<UsersResponse>('/users', { params: siteId ? { siteId } : {} })
      setUsers(res.data.users)
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false)
    }
  }, [admin, siteId])

  useEffect(() => { void fetchUsers() }, [fetchUsers])

  async function removeUser(id: string) {
    if (!confirm('Remove this member? They will lose access immediately.')) return
    const prev = users
    setUsers((u) => u.filter((x) => (x._id ?? x.id) !== id))
    try {
      await api.delete(`/users/${id}`)
    } catch {
      setUsers(prev) // revert on failure
    }
  }

  async function resetPassword(u: UserItem) {
    const id = u._id ?? u.id
    if (!id) return
    if (!confirm(`Reset password for ${u.name}? A new password will be generated to share with them.`)) return
    const password = generatePassword()
    try {
      await api.post(`/users/${id}/reset-password`, { password })
      setCreated({ name: u.name, email: u.email, password })
    } catch {
      alert('Could not reset the password. Please try again.')
    }
  }

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath="/users"
      siteName={user?.name ?? 'FireGuard'}
      userName={user?.name ?? 'Admin'}
      userRole={user?.role}
      onNavigate={(path) => {
        if (path === '/logout') { logout(); return }
        navigate(path)
      }}
      onRefresh={() => void fetchUsers()}
    >
      {children}
    </AppShell>
  )

  // Members shouldn't reach this page via the nav, but guard direct URLs too.
  if (!admin) {
    return shell(
      <div className="flex flex-col items-center justify-center text-center py-20">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Admins only</h2>
        <p className="text-sm text-slate-500">You don't have permission to manage users on this account.</p>
      </div>
    )
  }

  return shell(
    <>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Users</h1>
          <p className="text-sm text-slate-500">
            {users.length} member{users.length === 1 ? '' : 's'} with access to this account
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>+ Add member</Button>
      </div>

      <SectionCard title="Team members" accent="#7C3AED">
        {loading ? (
          <div className="flex items-center justify-center h-28 text-sm text-slate-500">Loading…</div>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No members yet. Add your first one.</p>
        ) : (
          <div className="space-y-1">
            {users.map((u) => {
              const uid = u._id ?? u.id ?? u.email
              const isSelf = u.email === user?.email
              return (
                <div key={uid} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
                    {u.name[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {u.name}{isSelf && <span className="text-xs text-slate-400"> (you)</span>}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] ?? 'bg-slate-100 text-slate-600'}`}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                  <button onClick={() => void resetPassword(u)} className="text-slate-300 hover:text-indigo-500 transition-colors" title="Reset password">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
                  </button>
                  {!isSelf && (
                    <button onClick={() => void removeUser(uid)} className="text-slate-300 hover:text-red-500 transition-colors" title="Remove member">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <p className="text-xs text-slate-400 mt-4 max-w-2xl">
        <strong>Admin</strong> can manage users and gateways. <strong>Member</strong> can view the dashboard and
        acknowledge alarms, but cannot add users or gateways. <strong>Viewer</strong> is read-only.
      </p>

      {showAdd && (
        <AddMemberModal
          siteId={siteId}
          onClose={() => setShowAdd(false)}
          onAdded={(u, creds) => {
            setShowAdd(false)
            setUsers((prev) => [u, ...prev])
            setCreated(creds)
          }}
        />
      )}
      {created && <CredentialsCard creds={created} onDone={() => setCreated(null)} />}
    </>
  )
}
