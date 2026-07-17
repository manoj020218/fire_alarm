/**
 * Reports page — generate a CSV report over a date range and view past reports.
 * POST /reports/generate returns the CSV inline (downloaded); GET /reports lists history.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import type { ReportItem, ReportsResponse, ReportType } from '../lib/types'
import axios from 'axios'

import AppShell from '../components/ui/AppShell'
import SectionCard from '../components/ui/SectionCard'
import Dropdown from '../components/ui/Dropdown'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import type { Status } from '../lib/utils'

const TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'alarm_summary', label: 'Alarm summary' },
  { value: 'daily', label: 'Daily telemetry' },
  { value: 'weekly', label: 'Weekly telemetry' },
  { value: 'monthly', label: 'Monthly telemetry' },
  { value: 'custom', label: 'Custom range' },
]

const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]))

function todayISO(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function statusFor(s: ReportItem['status']): Status {
  if (s === 'ready') return 'ok'
  if (s === 'failed') return 'critical'
  return 'idle'
}

export default function Reports() {
  const navigate = useNavigate()
  const { user, siteId, logout } = useAuth()

  const [type, setType] = useState<ReportType>('alarm_summary')
  const [from, setFrom] = useState(todayISO(-7))
  const [to, setTo] = useState(todayISO(0))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [reports, setReports] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReports = useCallback(async () => {
    try {
      const res = await api.get<ReportsResponse>('/reports', { params: siteId ? { siteId } : {} })
      setReports(res.data.reports)
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => { void fetchReports() }, [fetchReports])

  async function generate() {
    setError(null); setOk(null)
    if (!siteId) { setError('No site selected for this report.'); return }
    if (from > to) { setError('“From” date must be on or before “To” date.'); return }
    setBusy(true)
    try {
      const res = await api.post(
        '/reports/generate',
        {
          siteId,
          type,
          format: 'csv',
          rangeFrom: new Date(from).toISOString(),
          rangeTo: new Date(`${to}T23:59:59`).toISOString(),
        },
        { responseType: 'blob' }
      )
      // Trigger download of the returned CSV
      const blob = new Blob([res.data as BlobPart], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fireguard-${type}-${from}_to_${to}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setOk('Report generated and downloaded.')
      void fetchReports()
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.status === 501
          ? 'PDF export is not available yet — CSV was used.'
          : 'Could not generate the report. Please try again.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell
      currentPath="/reports"
      siteName={user?.name ?? 'FireGuard'}
      userName={user?.name ?? 'Admin'}
      userRole={user?.role}
      onNavigate={(path) => {
        if (path === '/logout') { logout(); return }
        navigate(path)
      }}
      onRefresh={() => void fetchReports()}
    >
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Reports</h1>
        <p className="text-sm text-slate-500">Export alarm and telemetry history as CSV</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Generate */}
        <SectionCard title="Generate report" accent="#6366F1" className="xl:col-span-1">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Report type</label>
              <Dropdown options={TYPE_OPTIONS} value={type} onChange={(v) => setType(v as ReportType)} />
            </div>
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            {ok && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{ok}</p>}

            <Button variant="primary" size="md" className="w-full justify-center" loading={busy} onClick={() => void generate()}>
              Generate CSV
            </Button>
          </div>
        </SectionCard>

        {/* History */}
        <SectionCard title="Recent reports" accent="#22C55E" className="xl:col-span-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-500">Loading…</div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">No reports generated yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Range</th>
                    <th className="py-2 pr-3 font-medium">Requested</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r._id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-700">{TYPE_LABEL[r.type] ?? r.type}</td>
                      <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">
                        {new Date(r.rangeFrom).toLocaleDateString('en-IN')} – {new Date(r.rangeTo).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">
                        {new Date(r.requestedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={statusFor(r.status)} label={r.status === 'ready' ? 'Ready' : r.status === 'failed' ? 'Failed' : 'Pending'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  )
}
