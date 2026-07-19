/**
 * DevicesPanel — manage a gateway's Modbus devices (register map). Add/edit/remove
 * devices; each save re-pushes the full register map to the gateway via config/set.
 */
import { useEffect, useState, useCallback } from 'react'
import { api } from '../../lib/api'
import type { GatewayItem, DeviceItem, DeviceType, DevicesResponse } from '../../lib/types'
import Button from './Button'
import Input from './Input'
import Dropdown from './Dropdown'
import axios from 'axios'

const DEVICE_TYPES: { value: DeviceType; label: string }[] = [
  { value: 'pump', label: 'Pump' },
  { value: 'pressure_sensor', label: 'Pressure sensor' },
  { value: 'level_sensor', label: 'Level / tank sensor' },
  { value: 'voltage_sensor', label: 'Voltage / battery' },
  { value: 'fire_panel', label: 'Fire alarm panel' },
  { value: 'pa_system', label: 'PA system' },
  { value: 'ventilation', label: 'Ventilation' },
  { value: 'valve', label: 'Valve' },
  { value: 'digital_input', label: 'Digital input' },
  { value: 'digital_output', label: 'Digital output' },
]
const TYPE_LABEL: Record<string, string> = Object.fromEntries(DEVICE_TYPES.map((t) => [t.value, t.label]))

interface FormState {
  deviceId: string
  label: string
  type: DeviceType
  slaveId: string
  fc: string
  regAddr: string
  scale: string
  unit: string
}
const emptyForm: FormState = { deviceId: '', label: '', type: 'pump', slaveId: '1', fc: '3', regAddr: '0', scale: '1', unit: '' }

export default function DevicesPanel({ gateway, onClose }: { gateway: GatewayItem; onClose: () => void }) {
  const gid = gateway.gatewayId
  const [devices, setDevices] = useState<DeviceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<string | null>(null) // deviceId being edited
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchDevices = useCallback(async () => {
    try {
      const res = await api.get<DevicesResponse>(`/gateways/${gid}/devices`)
      setDevices(res.data.devices)
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false)
    }
  }, [gid])

  useEffect(() => { void fetchDevices() }, [fetchDevices])

  function openAdd() {
    setForm(emptyForm); setEditing(null); setError(null); setShowForm(true)
  }
  function openEdit(d: DeviceItem) {
    setForm({
      deviceId: d.deviceId, label: d.label, type: d.type,
      slaveId: String(d.modbus?.slaveId ?? 1), fc: String(d.modbus?.fc ?? 3),
      regAddr: String(d.modbus?.regAddr ?? 0), scale: String(d.modbus?.scale ?? 1),
      unit: d.modbus?.unit ?? '',
    })
    setEditing(d.deviceId); setError(null); setShowForm(true)
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) { setForm((f) => ({ ...f, [k]: v })) }

  async function save() {
    setError(null)
    const deviceId = form.deviceId.trim()
    if (!deviceId || !form.label.trim() || !form.unit.trim()) {
      setError('Device ID, label and unit are required.')
      return
    }
    const body = {
      deviceId,
      type: form.type,
      label: form.label.trim(),
      unit: form.unit.trim(),
      modbus: {
        slaveId: Number(form.slaveId), fc: Number(form.fc), regAddr: Number(form.regAddr),
        scale: Number(form.scale) || 1, unit: form.unit.trim(),
      },
    }
    setBusy(true)
    try {
      if (editing) await api.put(`/gateways/${gid}/devices/${editing}`, body)
      else await api.post(`/gateways/${gid}/devices`, body)
      setShowForm(false)
      await fetchDevices()
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : 'Could not save the device.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove(deviceId: string) {
    if (!confirm(`Remove ${deviceId} from this gateway?`)) return
    const prev = devices
    setDevices((d) => d.filter((x) => x.deviceId !== deviceId))
    try {
      await api.delete(`/gateways/${gid}/devices/${deviceId}`)
    } catch {
      setDevices(prev)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">{gateway.name} — Devices</h3>
            <p className="text-xs text-slate-500">{gid} · Modbus register map</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 max-h-[72vh] overflow-y-auto">
          {!showForm && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500">{devices.length} device{devices.length === 1 ? '' : 's'} configured</p>
              <Button variant="primary" size="sm" onClick={openAdd}>+ Add device</Button>
            </div>
          )}

          {showForm ? (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">{editing ? `Edit ${editing}` : 'Add device'}</h4>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Device ID (tag)" value={form.deviceId} onChange={(e) => set('deviceId', e.target.value)} disabled={!!editing} placeholder="jockeyPump" />
                <Input label="Label" value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="Jockey Pump" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                <Dropdown options={DEVICE_TYPES} value={form.type} onChange={(v) => set('type', v as DeviceType)} />
              </div>
              <p className="text-xs font-semibold text-slate-500 pt-1">Modbus (RS485)</p>
              <div className="grid grid-cols-3 gap-2">
                <Input label="Slave ID" type="number" value={form.slaveId} onChange={(e) => set('slaveId', e.target.value)} />
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Function</label>
                  <Dropdown
                    options={[
                      { value: '3', label: 'FC3 Holding' },
                      { value: '4', label: 'FC4 Input' },
                      { value: '1', label: 'FC1 Coil' },
                      { value: '2', label: 'FC2 Discrete' },
                    ]}
                    value={form.fc}
                    onChange={(v) => set('fc', v)}
                  />
                </div>
                <Input label="Register" type="number" value={form.regAddr} onChange={(e) => set('regAddr', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Scale (raw × scale)" type="number" value={form.scale} onChange={(e) => set('scale', e.target.value)} />
                <Input label="Unit" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="bar / % / V" />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="secondary" size="md" className="flex-1 justify-center" onClick={() => setShowForm(false)} disabled={busy}>Cancel</Button>
                <Button variant="primary" size="md" className="flex-1 justify-center" loading={busy} onClick={() => void save()}>{editing ? 'Save' : 'Add'} &amp; push</Button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-24 text-sm text-slate-500">Loading…</div>
          ) : devices.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No devices yet. Add the equipment wired to this gateway's RS485 bus.</p>
          ) : (
            <div className="space-y-1">
              {devices.map((d) => (
                <div key={d.deviceId} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{d.label} <span className="text-xs text-slate-400">({TYPE_LABEL[d.type] ?? d.type})</span></p>
                    <p className="text-xs text-slate-500 truncate">
                      {d.deviceId} · slave {d.modbus?.slaveId ?? '—'}, FC{d.modbus?.fc ?? '—'}, reg {d.modbus?.regAddr ?? '—'} · {d.modbus?.unit ?? d.unit ?? ''}
                    </p>
                  </div>
                  <button onClick={() => openEdit(d)} className="text-slate-400 hover:text-indigo-600 text-xs font-medium">Edit</button>
                  <button onClick={() => void remove(d.deviceId)} className="text-slate-300 hover:text-red-500" title="Remove">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
