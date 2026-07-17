/**
 * Gateways page — list the site's gateways, their live status, and let a
 * CLIENT_ADMIN add a new gateway by claiming it with the code on the unit.
 * Reuses the approved kit (AppShell, SectionCard, Button, Input, StatusBadge).
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { formatUptime, formatLastSeen, formatSignal } from '../lib/mapper'
import type { GatewayItem, GatewaysResponse, ClaimGatewayResponse } from '../lib/types'
import axios from 'axios'

import AppShell from '../components/ui/AppShell'
import SectionCard from '../components/ui/SectionCard'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import GatewayIcon from '../components/icons/GatewayIcon'

const isAdmin = (role?: string) =>
  role === 'CLIENT_ADMIN' || role === 'VENDOR_ADMIN' || role === 'JENIX_SUPER_ADMIN'

// ── Uplink pill ─────────────────────────────────────────────────────────────
function UplinkPill({ uplink }: { uplink?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    '4g': { label: '4G', cls: 'bg-violet-100 text-violet-700' },
    lan: { label: 'LAN', cls: 'bg-sky-100 text-sky-700' },
    wifi: { label: 'Wi-Fi', cls: 'bg-emerald-100 text-emerald-700' },
  }
  const m = uplink ? map[uplink] : undefined
  if (!m) return null
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
}

// ── Add-Gateway modal ───────────────────────────────────────────────────────
function AddGatewayModal({
  onClose,
  onClaimed,
}: {
  onClose: () => void
  onClaimed: (gw: GatewayItem) => void
}) {
  const [gatewayId, setGatewayId] = useState('')
  const [claimCode, setClaimCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (gatewayId.trim().length < 3 || claimCode.trim().length < 4) {
      setError('Enter the Gateway ID and claim code exactly as printed on the unit.')
      return
    }
    setBusy(true)
    try {
      const res = await api.post<ClaimGatewayResponse>('/gateways/claim', {
        gatewayId: gatewayId.trim(),
        claimCode: claimCode.trim(),
        name: name.trim() || undefined,
      })
      onClaimed(res.data.gateway)
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : 'Could not add this gateway. Check the ID and claim code and try again.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <GatewayIcon size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Add a Gateway</h3>
            <p className="text-xs text-slate-500">Bind a new FireGuard Gateway to this site.</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 my-4 leading-relaxed">
          Find the <strong>Gateway ID</strong> and <strong>Claim Code</strong> on the label on your FireGuard
          Gateway (or scan the QR code). Enter them below to connect it to your dashboard.
        </p>

        <div className="space-y-3">
          <Input
            label="Gateway ID"
            placeholder="e.g. FG-9F3A2C"
            value={gatewayId}
            onChange={(e) => setGatewayId(e.target.value.toUpperCase())}
            autoFocus
          />
          <Input
            label="Claim Code"
            placeholder="e.g. K7P2M9QX"
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
          />
          <Input
            label="Name (optional)"
            placeholder="e.g. Basement Pump Room"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</p>
        )}

        <div className="flex gap-2 mt-5">
          <Button variant="secondary" size="md" className="flex-1 justify-center" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="md" className="flex-1 justify-center" onClick={() => void submit()} loading={busy}>
            Add Gateway
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Gateway card ────────────────────────────────────────────────────────────
function GatewayCard({ gw }: { gw: GatewayItem }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gw.online ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
          <GatewayIcon size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800 truncate">{gw.name}</p>
            <UplinkPill uplink={gw.uplink} />
          </div>
          <p className="text-xs text-slate-500 truncate">{gw.gatewayId}</p>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${gw.online ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
          {gw.online ? 'Online' : 'Offline'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4 text-xs text-slate-600">
        <div className="flex justify-between"><span>Firmware</span><span className="font-medium text-slate-800">v{gw.fw}</span></div>
        <div className="flex justify-between"><span>Signal</span><span className="font-medium text-slate-800">{formatSignal(gw)}</span></div>
        <div className="flex justify-between"><span>Uptime</span><span className="font-medium text-slate-800">{gw.uptime != null ? formatUptime(gw.uptime) : '—'}</span></div>
        <div className="flex justify-between"><span>Last seen</span><span className={`font-medium ${gw.online ? 'text-green-600' : 'text-red-500'}`}>{formatLastSeen(gw.lastSeenAt)}</span></div>
      </div>
    </div>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────
function EmptyGateways({ canAdd, onAdd }: { canAdd: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
        <GatewayIcon size={36} />
      </div>
      <h2 className="text-lg font-bold text-slate-800 mb-1">No gateways yet</h2>
      <p className="text-sm text-slate-500 max-w-sm mb-5">
        Add your FireGuard Gateway using the ID and claim code printed on the unit, and your live monitoring will
        appear here.
      </p>
      {canAdd && (
        <Button variant="primary" size="md" onClick={onAdd}>+ Add Gateway</Button>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function Gateways() {
  const navigate = useNavigate()
  const { user, siteId, logout } = useAuth()

  const [gateways, setGateways] = useState<GatewayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const canAdd = isAdmin(user?.role)

  const fetchGateways = useCallback(async () => {
    try {
      const res = await api.get<GatewaysResponse>('/gateways')
      const list = siteId ? res.data.gateways.filter((g) => g.siteId === siteId) : res.data.gateways
      setGateways(list)
      setError(null)
    } catch {
      setError('Could not load gateways. Retrying on refresh.')
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    void fetchGateways()
  }, [fetchGateways])

  const onlineCount = gateways.filter((g) => g.online).length

  return (
    <AppShell
      currentPath="/gateways"
      siteName={user?.name ?? 'FireGuard'}
      userName={user?.name ?? 'Admin'}
      userRole={user?.role}
      onNavigate={(path) => {
        if (path === '/logout') { logout(); return }
        navigate(path)
      }}
      onRefresh={() => void fetchGateways()}
    >
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gateways</h1>
          <p className="text-sm text-slate-500">
            {gateways.length} device{gateways.length === 1 ? '' : 's'} · {onlineCount} online
          </p>
        </div>
        {canAdd && gateways.length > 0 && (
          <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>+ Add Gateway</Button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => void fetchGateways()} className="text-xs underline ml-3">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-sm text-slate-500">Loading gateways…</div>
      ) : gateways.length === 0 ? (
        <SectionCard title="Your Gateways" accent="#6366F1">
          <EmptyGateways canAdd={canAdd} onAdd={() => setShowAdd(true)} />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {gateways.map((gw) => (
            <GatewayCard key={gw.gatewayId} gw={gw} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddGatewayModal
          onClose={() => setShowAdd(false)}
          onClaimed={(gw) => {
            setShowAdd(false)
            setGateways((prev) => {
              const exists = prev.some((g) => g.gatewayId === gw.gatewayId)
              return exists ? prev.map((g) => (g.gatewayId === gw.gatewayId ? gw : g)) : [gw, ...prev]
            })
          }}
        />
      )}
    </AppShell>
  )
}
