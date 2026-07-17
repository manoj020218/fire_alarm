/**
 * Alarms page — full alarm history with severity/status filters, pagination,
 * and acknowledge. Reuses AlarmTable, Tabs, Dropdown and the ACK modal pattern.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { mapAlarms } from '../lib/mapper'
import type { AlarmDoc, AlarmsResponse } from '../lib/types'
import type { AlarmItem } from '../components/ui/AlarmRow'

import AppShell from '../components/ui/AppShell'
import SectionCard from '../components/ui/SectionCard'
import AlarmTable from '../components/ui/AlarmTable'
import Tabs from '../components/ui/Tabs'
import Dropdown from '../components/ui/Dropdown'
import Button from '../components/ui/Button'

type Severity = 'all' | 'critical' | 'warning'
type StatusFilter = 'all' | 'unack' | 'ack'
const PAGE_SIZE = 20

// ── ACK modal ───────────────────────────────────────────────────────────────
function AckModal({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <h3 className="text-base font-bold text-slate-800 mb-2">Acknowledge alarm</h3>
        <p className="text-sm text-slate-500 mb-4">Briefly describe the action taken.</p>
        <textarea
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
          rows={3}
          placeholder="e.g. Inspected pump, restarted manually."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1 justify-center"
            onClick={() => onConfirm(reason.trim() || 'Acknowledged from dashboard')}
          >
            Acknowledge
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function Alarms() {
  const navigate = useNavigate()
  const { user, siteId, logout } = useAuth()

  const [severity, setSeverity] = useState<Severity>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  const [alarmDocs, setAlarmDocs] = useState<AlarmDoc[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ackId, setAckId] = useState<string | null>(null)

  const fetchAlarms = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | boolean> = { page, limit: PAGE_SIZE }
      if (siteId) params.siteId = siteId
      if (severity !== 'all') params.severity = severity
      if (status === 'unack') params.acknowledged = false
      if (status === 'ack') params.acknowledged = true

      const res = await api.get<AlarmsResponse>('/alarms', { params })
      setAlarmDocs(res.data.alarms)
      setTotal(res.data.pagination.total)
      setPages(res.data.pagination.pages || 1)
      setError(null)
    } catch {
      setError('Could not load alarms. Retry on refresh.')
    } finally {
      setLoading(false)
    }
  }, [siteId, severity, status, page])

  useEffect(() => { void fetchAlarms() }, [fetchAlarms])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [severity, status])

  async function confirmAck(reason: string) {
    const id = ackId
    setAckId(null)
    if (!id) return
    try {
      await api.post(`/alarms/${id}/ack`, { reason })
      setAlarmDocs((prev) =>
        prev.map((a) => (a._id === id ? { ...a, acknowledged: true, active: false, acknowledgedBy: user?.email } : a))
      )
    } catch {
      void fetchAlarms()
    }
  }

  const alarms: AlarmItem[] = mapAlarms(alarmDocs)

  const severityTabs = [
    { id: 'all', label: 'All' },
    { id: 'critical', label: 'Critical' },
    { id: 'warning', label: 'Warning' },
  ]

  return (
    <AppShell
      currentPath="/alarms"
      alarmCount={alarmDocs.filter((a) => !a.acknowledged).length}
      siteName={user?.name ?? 'FireGuard'}
      userName={user?.name ?? 'Admin'}
      userRole={user?.role}
      onNavigate={(path) => {
        if (path === '/logout') { logout(); return }
        navigate(path)
      }}
      onRefresh={() => void fetchAlarms()}
    >
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Alarm History</h1>
        <p className="text-sm text-slate-500">{total} alarm{total === 1 ? '' : 's'} recorded</p>
      </div>

      <SectionCard title="Alarms" accent="#EF4444" className="mb-5"
        action={
          <div className="w-40">
            <Dropdown
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'unack', label: 'Unacknowledged' },
                { value: 'ack', label: 'Acknowledged' },
              ]}
              value={status}
              onChange={(v) => setStatus(v as StatusFilter)}
            />
          </div>
        }
      >
        <Tabs items={severityTabs} activeTab={severity} onChange={(id) => setSeverity(id as Severity)} className="mb-4" />

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => void fetchAlarms()} className="text-xs underline ml-3">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-slate-500">Loading alarms…</div>
        ) : alarms.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-14">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">No alarms match these filters</p>
            <p className="text-xs text-slate-400 mt-1">You're all clear here.</p>
          </div>
        ) : (
          <AlarmTable alarms={alarms} onAck={(id) => setAckId(id)} />
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next</Button>
            </div>
          </div>
        )}
      </SectionCard>

      {ackId && <AckModal onConfirm={(reason) => void confirmAck(reason)} onCancel={() => setAckId(null)} />}
    </AppShell>
  )
}
