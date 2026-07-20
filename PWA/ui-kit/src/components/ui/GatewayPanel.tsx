/**
 * GatewayPanel — manage a gateway's SMS alerts, SIM operator, and run on-demand
 * SIM checks (refresh info, read inbox, balance USSD, test SMS). Results stream
 * back live over the 'sim' socket event.
 */
import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { connectSocket, getSocket } from '../../lib/socket'
import type { GatewayItem, GatewaySmsConfig, GatewaySim, SimEvent } from '../../lib/types'
import Button from './Button'
import Input from './Input'
import Toggle from './Toggle'
import Dropdown from './Dropdown'

// India operator presets — editable after selection.
const OPERATORS: Record<string, { label: string; balanceUssd: string; numberUssd: string }> = {
  airtel: { label: 'Airtel', balanceUssd: '*123#', numberUssd: '*121*9#' },
  jio:    { label: 'Jio',    balanceUssd: '*333#', numberUssd: '*1#' },
  vi:     { label: 'Vi (Vodafone Idea)', balanceUssd: '*199#', numberUssd: '*199#' },
  bsnl:   { label: 'BSNL',   balanceUssd: '*123#', numberUssd: '*222#' },
  custom: { label: 'Other / Custom', balanceUssd: '', numberUssd: '' },
}

type Waiting = null | 'sim_info' | 'read_sms' | 'ussd' | 'test_sms' | 'test_call'

export default function GatewayPanel({
  gateway,
  siteId,
  onClose,
  onUpdated,
}: {
  gateway: GatewayItem
  siteId: string | null
  onClose: () => void
  onUpdated: (patch: Partial<GatewayItem>) => void
}) {
  const cfg = gateway.smsConfig
  const [operator, setOperator] = useState(cfg?.operator ?? 'airtel')
  const [numbers, setNumbers] = useState(cfg?.numbers ?? '')
  const [enabled, setEnabled] = useState(cfg?.enabled ?? false)
  const [balanceUssd, setBalanceUssd] = useState(cfg?.balanceUssd ?? OPERATORS.airtel.balanceUssd)
  const [numberUssd, setNumberUssd] = useState(cfg?.numberUssd ?? OPERATORS.airtel.numberUssd)

  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [sim, setSim] = useState<GatewaySim | undefined>(gateway.sim)
  const [waiting, setWaiting] = useState<Waiting>(null)
  const [note, setNote] = useState<string | null>(null)
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Choosing a preset fills the USSD codes (still editable).
  function pickOperator(op: string) {
    setOperator(op)
    const preset = OPERATORS[op]
    if (preset && op !== 'custom') {
      setBalanceUssd(preset.balanceUssd)
      setNumberUssd(preset.numberUssd)
    }
  }

  // Live SIM responses over socket.
  useEffect(() => {
    const token = localStorage.getItem('fg_token')
    if (token && siteId) connectSocket(token, siteId)
    const socket = getSocket()
    if (!socket) return
    const onSim = (ev: SimEvent) => {
      if (ev.gatewayId !== gateway.gatewayId) return
      setSim((prev) => ({ ...prev, ...ev, lastCheckedAt: ev.at ?? new Date().toISOString() }))
      setWaiting(null)
      if (waitTimer.current) clearTimeout(waitTimer.current)
      if (ev.error) setNote(`Gateway reported: ${ev.error}`)
      else if (ev.type === 'test_sms' && ev.ok) setNote('Test SMS sent ✓')
      else if (ev.type === 'test_call' && ev.ok) setNote('Call placed ✓ — the number should get a missed call.')
      else setNote(null)
    }
    socket.on('sim', onSim)
    return () => {
      socket.off('sim', onSim)
      if (waitTimer.current) clearTimeout(waitTimer.current)
    }
  }, [gateway.gatewayId, siteId])

  async function saveConfig() {
    setSaving(true)
    setSavedMsg(null)
    try {
      const body: GatewaySmsConfig = { enabled, numbers, operator, balanceUssd, numberUssd }
      await api.put(`/gateways/${gateway.gatewayId}/sms`, body)
      onUpdated({ smsConfig: body })
      setSavedMsg('Saved and pushed to the gateway.')
      setTimeout(() => setSavedMsg(null), 3000)
    } catch {
      setSavedMsg('Could not save. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  async function runCommand(command: Waiting, params?: Record<string, unknown>) {
    if (!command) return
    if (!gateway.online) {
      setNote('Gateway is offline — it will run this when it reconnects.')
    } else {
      setNote(null)
    }
    setWaiting(command)
    try {
      await api.post(`/gateways/${gateway.gatewayId}/command`, { command, params })
      if (waitTimer.current) clearTimeout(waitTimer.current)
      waitTimer.current = setTimeout(() => {
        setWaiting(null)
        setNote('No response yet — the gateway may be offline or busy. Try again shortly.')
      }, 30_000)
    } catch {
      setWaiting(null)
      setNote('Could not send the command.')
    }
  }

  const firstNumber = numbers.split(',').map((s) => s.trim()).filter(Boolean)[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">{gateway.name}</h3>
            <p className="text-xs text-slate-500">{gateway.gatewayId} · SMS &amp; SIM</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* SMS alerts + operator */}
          <section>
            <h4 className="text-sm font-semibold text-slate-800 mb-3">SMS alerts</h4>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-600">Send SMS on alarms</span>
              <Toggle checked={enabled} onChange={setEnabled} />
            </div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Alert numbers (comma-separated, E.164)</label>
            <Input value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder="+9198XXXXXXXX, +9172XXXXXXXX" />

            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">SIM operator</label>
              <Dropdown
                options={Object.entries(OPERATORS).map(([v, o]) => ({ value: v, label: o.label }))}
                value={operator}
                onChange={pickOperator}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Balance USSD</label>
                <Input value={balanceUssd} onChange={(e) => setBalanceUssd(e.target.value)} placeholder="*123#" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Number USSD</label>
                <Input value={numberUssd} onChange={(e) => setNumberUssd(e.target.value)} placeholder="*1#" />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Button variant="primary" size="sm" loading={saving} onClick={() => void saveConfig()}>Save &amp; push</Button>
              {savedMsg && <span className="text-xs text-emerald-600">{savedMsg}</span>}
            </div>
          </section>

          {/* SIM status */}
          <section className="border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-800">SIM status</h4>
              {sim?.lastCheckedAt && (
                <span className="text-[11px] text-slate-400">
                  checked {new Date(sim.lastCheckedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <Row label="Number" value={sim?.number ?? '—'} />
              <Row label="Operator" value={sim?.operator ?? OPERATORS[operator]?.label ?? '—'} />
              <Row label="ICCID" value={sim?.iccid ?? '—'} />
              <Row label="Signal" value={sim?.signal != null ? `${sim.signal}/31` : '—'} />
              <Row label="Registered" value={sim?.registered == null ? '—' : sim.registered ? 'Yes' : 'No'} good={sim?.registered} />
              <Row label="Can send SMS" value={sim?.canSend == null ? '—' : sim.canSend ? 'Yes' : 'No'} good={sim?.canSend} />
            </div>

            {sim?.balanceText && (
              <div className="mt-3 text-xs bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-indigo-800 whitespace-pre-wrap">
                <span className="font-semibold">Balance:</span> {sim.balanceText}
              </div>
            )}

            {sim?.messages && sim.messages.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-600 mb-1">Recent messages</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {sim.messages.map((m, i) => (
                    <div key={i} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <div className="flex justify-between text-slate-400 text-[10px]"><span>{m.from ?? 'Operator'}</span><span>{m.ts ?? ''}</span></div>
                      <div className="text-slate-700 whitespace-pre-wrap">{m.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {note && <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{note}</p>}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="secondary" size="sm" className="justify-center" loading={waiting === 'sim_info'} onClick={() => void runCommand('sim_info')}>Refresh SIM</Button>
              <Button variant="secondary" size="sm" className="justify-center" loading={waiting === 'read_sms'} onClick={() => void runCommand('read_sms')}>Read messages</Button>
              <Button variant="secondary" size="sm" className="justify-center" loading={waiting === 'ussd'} onClick={() => void runCommand('ussd', { code: balanceUssd })}>Check balance</Button>
              <Button variant="secondary" size="sm" className="justify-center" loading={waiting === 'test_sms'} disabled={!firstNumber} onClick={() => void runCommand('test_sms', { number: firstNumber })}>Send test SMS</Button>
              <Button variant="secondary" size="sm" className="justify-center col-span-2" loading={waiting === 'test_call'} disabled={!firstNumber} onClick={() => void runCommand('test_call', { number: firstNumber })}>Test call (missed-call alert)</Button>
            </div>
            {!firstNumber && <p className="text-[11px] text-slate-400 mt-1">Add an alert number above to enable the test SMS / call.</p>}
          </section>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${good === true ? 'text-emerald-600' : good === false ? 'text-red-500' : 'text-slate-800'}`}>{value}</span>
    </div>
  )
}
