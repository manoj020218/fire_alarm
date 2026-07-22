/**
 * Maps real API telemetry/alarm/gateway shapes into the component prop shapes
 * that Dashboard uses (matching what mockData.ts produced).
 */
import type { TelemetryDoc, AlarmDoc, GatewayItem } from './types'
import type { DeviceData } from '../data/mockData'
import type { AlarmItem } from '../components/ui/AlarmRow'
import type { Status } from './utils'

// ── Device ID → display name ──────────────────────────────────────────────────
const DEVICE_NAMES: Record<string, string> = {
  jockeyPump:        'Jockey Pump',
  mainPump1:         'Main Pump 1',
  mainPump2:         'Main Pump 2',
  dieselPump:        'Diesel Pump',
  sprinklerPressure: 'Sprinkler Pressure',
  hydrantPressure:   'Hydrant Pressure',
  waterTank:         'Water Tank',
  dieselFuelTank:    'DG Fuel Tank',
  dgBattery:         'DG Battery',
  fireAlarmPanel:    'Fire Alarm Panel',
  paSystem:          'PA System',
  ventilation:       'Ventilation',
  diModule:          'DI Module',
  doModule:          'DO Module',
}

const DEVICE_READING_LABELS: Record<string, string> = {
  jockeyPump:        'Supply Voltage',
  mainPump1:         'Supply Voltage',
  mainPump2:         'Supply Voltage',
  dieselPump:        'Supply Voltage',
  sprinklerPressure: 'Line Pressure',
  hydrantPressure:   'Line Pressure',
  waterTank:         'Level',
  dieselFuelTank:    'Level',
  dgBattery:         'Voltage',
  fireAlarmPanel:    'Panel Status',
  paSystem:          'Status',
  ventilation:       'Mode',
  diModule:          'Active Inputs',
  doModule:          'Active Outputs',
}

function deviceStatus(reading: { online: boolean; value?: number; status?: string }, deviceId: string): Status {
  if (!reading.online) return 'offline'

  // Pump: offline if voltage === 0, idle if ok
  if (['jockeyPump', 'mainPump1', 'mainPump2', 'dieselPump'].includes(deviceId)) {
    if (reading.value === undefined || reading.value === null) return 'offline'
    if (reading.value === 0) return 'critical'
    return 'idle'
  }

  // Pressure sensors
  if (deviceId === 'sprinklerPressure' || deviceId === 'hydrantPressure') {
    const v = reading.value ?? 0
    if (v >= 10) return 'critical'
    if (v >= 8) return 'warning'
    return 'ok'
  }

  // Tank levels
  if (deviceId === 'waterTank' || deviceId === 'dieselFuelTank') {
    const v = reading.value ?? 0
    if (v < 25) return 'critical'
    if (v < 70) return 'warning'
    return 'ok'
  }

  // Status-string devices
  if (reading.status) {
    const s = reading.status.toUpperCase()
    if (s === 'FAULT' || s === 'ERROR') return 'critical'
    if (s === 'WARNING') return 'warning'
    return 'ok'
  }

  return 'ok'
}

function deviceReading(
  reading: { online: boolean; value?: number; status?: string; unit?: string },
  deviceId: string
): DeviceData['reading'] {
  const label = DEVICE_READING_LABELS[deviceId] ?? 'Reading'

  // Status-string devices
  if (['fireAlarmPanel', 'paSystem', 'ventilation'].includes(deviceId)) {
    return { label, value: reading.status ?? (reading.online ? 'ONLINE' : 'OFFLINE') }
  }

  // DI/DO modules — show count from digitalInputs/Outputs if no value
  if (deviceId === 'diModule') {
    return { label, value: reading.value !== undefined ? String(reading.value) : (reading.online ? 'OK' : 'OFFLINE') }
  }
  if (deviceId === 'doModule') {
    return { label, value: reading.value !== undefined ? String(reading.value) : (reading.online ? 'OK' : 'OFFLINE') }
  }

  return {
    label,
    value: reading.value ?? (reading.online ? 0 : '--'),
    unit: reading.unit,
  }
}

// ── Main mapper: telemetry → DeviceData[] ─────────────────────────────────────
export function mapTelemetryToDevices(telemetry: TelemetryDoc): DeviceData[] {
  // A gateway that hasn't reported yet has no telemetry / no devices map — guard
  // it so an empty/partial doc yields [] instead of throwing on Object.entries().
  if (!telemetry || !telemetry.devices) return [];
  return Object.entries(telemetry.devices).map(([id, reading]) => ({
    id,
    name: DEVICE_NAMES[id] ?? id,
    status: deviceStatus(reading, id),
    reading: deviceReading(reading, id),
    voltage: reading.value,
  }))
}

// ── Alarm mapper ──────────────────────────────────────────────────────────────
export function mapAlarms(alarms: AlarmDoc[]): AlarmItem[] {
  return alarms.map((a) => ({
    id: a._id,
    severity: a.severity as 'critical' | 'warning' | 'info',
    device: DEVICE_NAMES[a.deviceId] ?? a.deviceId,
    parameter: a.parameter,
    value: a.value,
    timestamp: new Date(a.timestamp),
    acknowledged: a.acknowledged,
    acknowledgedBy: a.acknowledgedBy,
  }))
}

// ── Connection strip mapper ───────────────────────────────────────────────────
export function mapConnections(system: TelemetryDoc['system']) {
  return [
    {
      label: '4G LTE',
      status: (system.uplink === '4g' ? 'ok' : 'idle') as Status,
      sublabel: system.signal4g !== undefined ? `${system.signal4g} dBm` : undefined,
    },
    {
      label: 'LAN',
      status: (system.uplink === 'lan' ? 'ok' : 'idle') as Status,
    },
    {
      label: 'WiFi',
      status: (system.wifi === 'online' ? 'ok' : 'idle') as Status,
    },
    {
      label: 'MQTT',
      status: (system.mqtt === 'connected' ? 'ok' : 'critical') as Status,
    },
    {
      label: 'Cloud',
      status: (system.cloud === 'online' ? 'ok' : 'critical') as Status,
    },
    {
      label: 'RS485',
      status: (system.rs485 === 'ok' ? 'ok' : 'critical') as Status,
    },
  ]
}

// ── Uptime formatter ──────────────────────────────────────────────────────────
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ── Gateway last-seen formatter ───────────────────────────────────────────────
export function formatLastSeen(lastSeenAt: string | undefined): string {
  if (!lastSeenAt) return 'unknown'
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  if (diff < 30_000) return 'just now'
  if (diff < 120_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

// ── Signal label ──────────────────────────────────────────────────────────────
export function formatSignal(gw: GatewayItem): string {
  if (gw.signal4g !== undefined) return `${gw.signal4g} dBm (4G)`
  if (gw.rssi !== undefined) return `${gw.rssi} dBm`
  return 'N/A'
}
