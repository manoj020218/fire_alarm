/**
 * Trends page — historical telemetry charts from /telemetry/:gatewayId/range.
 * Pick a gateway + time window; each numeric device parameter becomes a
 * selectable series in the approved TrendChart component.
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import type { GatewayItem, GatewaysResponse, TelemetryDoc } from '../lib/types'

import AppShell from '../components/ui/AppShell'
import SectionCard from '../components/ui/SectionCard'
import Dropdown from '../components/ui/Dropdown'
import TrendChart, { type TrendSeries } from '../components/ui/TrendChart'

interface RangeResponse {
  ok: boolean
  telemetry: TelemetryDoc[]
}

const RANGES: Record<string, { label: string; hours: number }> = {
  '24h': { label: 'Last 24 hours', hours: 24 },
  '7d': { label: 'Last 7 days', hours: 24 * 7 },
  '30d': { label: 'Last 30 days', hours: 24 * 30 },
}

const SERIES_COLORS = ['#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#7C3AED', '#0EA5E9', '#EC4899', '#14B8A6']

// camelCase / snake_case → "Title Case"
function prettify(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function fmtTime(iso: string, hours: number): string {
  const d = new Date(iso)
  if (hours <= 24) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function Trends() {
  const navigate = useNavigate()
  const { user, siteId, logout } = useAuth()

  const [gateways, setGateways] = useState<GatewayItem[]>([])
  const [gatewayId, setGatewayId] = useState('')
  const [rangeKey, setRangeKey] = useState('24h')
  const [docs, setDocs] = useState<TelemetryDoc[]>([])
  const [activeSeries, setActiveSeries] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load gateways once
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<GatewaysResponse>('/gateways')
        const list = siteId ? res.data.gateways.filter((g) => g.siteId === siteId) : res.data.gateways
        setGateways(list)
        if (list[0]) setGatewayId(list[0].gatewayId)
      } catch {
        setError('Could not load gateways.')
      }
    })()
  }, [siteId])

  const fetchRange = useCallback(async () => {
    if (!gatewayId) return
    setLoading(true)
    try {
      const to = new Date()
      const from = new Date(to.getTime() - RANGES[rangeKey].hours * 3600_000)
      const res = await api.get<RangeResponse>(`/telemetry/${gatewayId}/range`, {
        params: { from: from.toISOString(), to: to.toISOString(), limit: 500 },
      })
      setDocs(res.data.telemetry ?? [])
      setError(null)
    } catch {
      setError('Could not load trend data for this gateway.')
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [gatewayId, rangeKey])

  useEffect(() => { void fetchRange() }, [fetchRange])

  // Build one series per numeric device parameter
  const series: TrendSeries[] = useMemo(() => {
    if (docs.length === 0) return []
    const hours = RANGES[rangeKey].hours
    const keys = new Set<string>()
    for (const d of docs) {
      for (const [k, r] of Object.entries(d.devices ?? {})) {
        if (typeof r?.value === 'number') keys.add(k)
      }
    }
    return Array.from(keys).map((key, i) => {
      const unit = docs.find((d) => d.devices?.[key]?.unit)?.devices?.[key]?.unit ?? ''
      const data = docs
        .filter((d) => typeof d.devices?.[key]?.value === 'number')
        .map((d) => ({ time: fmtTime(d.timestamp, hours), value: d.devices[key].value as number }))
      return {
        id: key,
        label: prettify(key),
        data,
        unit,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
      }
    })
  }, [docs, rangeKey])

  // Keep an active series id valid
  useEffect(() => {
    if (series.length && !series.some((s) => s.id === activeSeries)) {
      setActiveSeries(series[0].id)
    }
  }, [series, activeSeries])

  return (
    <AppShell
      currentPath="/trends"
      siteName={user?.name ?? 'FireGuard'}
      userName={user?.name ?? 'Admin'}
      userRole={user?.role}
      onNavigate={(path) => {
        if (path === '/logout') { logout(); return }
        navigate(path)
      }}
      onRefresh={() => void fetchRange()}
    >
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Trends &amp; Analytics</h1>
          <p className="text-sm text-slate-500">Historical parameter values over time</p>
        </div>
        <div className="flex gap-2">
          <div className="w-44">
            <Dropdown
              options={gateways.map((g) => ({ value: g.gatewayId, label: g.name || g.gatewayId }))}
              value={gatewayId}
              onChange={setGatewayId}
              placeholder="Select gateway"
            />
          </div>
          <div className="w-40">
            <Dropdown
              options={Object.entries(RANGES).map(([k, v]) => ({ value: k, label: v.label }))}
              value={rangeKey}
              onChange={setRangeKey}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => void fetchRange()} className="text-xs underline ml-3">Retry</button>
        </div>
      )}

      {gateways.length === 0 ? (
        <SectionCard title="Trends" accent="#6366F1">
          <p className="text-sm text-slate-500 py-10 text-center">Add a gateway to see historical trends.</p>
        </SectionCard>
      ) : loading ? (
        <div className="flex items-center justify-center h-56 text-sm text-slate-500">Loading trend data…</div>
      ) : series.length === 0 ? (
        <SectionCard title="Trends" accent="#6366F1">
          <p className="text-sm text-slate-500 py-10 text-center">
            No numeric telemetry recorded for this gateway in the selected window yet.
          </p>
        </SectionCard>
      ) : (
        <TrendChart
          series={series}
          tabs={series.map((s) => s.id)}
          activeTab={activeSeries}
          onTabChange={setActiveSeries}
        />
      )}
    </AppShell>
  )
}
