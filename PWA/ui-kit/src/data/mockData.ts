import { useEffect, useState, useCallback } from 'react'
import type { AlarmItem } from '../components/ui/AlarmRow'

// ─── Site ───────────────────────────────────────────────────────────────────
export const SITE = {
  id: 'SITE001',
  name: 'ABC Towers, Mumbai',
  gateway: 'JNX-FG-AB12',
  floor: 'Basement Pump Room',
}

// ─── Connection status ───────────────────────────────────────────────────────
export const connections = [
  { label: '4G LTE', status: 'ok' as const, sublabel: '-78 dBm' },
  { label: 'LAN', status: 'idle' as const },
  { label: 'WiFi', status: 'idle' as const },
  { label: 'MQTT', status: 'ok' as const },
  { label: 'Cloud', status: 'ok' as const },
  { label: 'RS485', status: 'ok' as const },
]

// ─── Device telemetry ────────────────────────────────────────────────────────
export interface DeviceData {
  id: string
  name: string
  status: 'ok' | 'warning' | 'critical' | 'offline' | 'idle'
  reading: { label: string; value: string | number; unit?: string }
  voltage?: number
}

export const initialDevices: DeviceData[] = [
  { id: 'jockeyPump',         name: 'Jockey Pump',        status: 'ok',       reading: { label: 'Supply Voltage', value: 415, unit: 'V' },  voltage: 415 },
  { id: 'mainPump1',          name: 'Main Pump 1',         status: 'idle',     reading: { label: 'Supply Voltage', value: 414, unit: 'V' },  voltage: 414 },
  { id: 'mainPump2',          name: 'Main Pump 2',         status: 'idle',     reading: { label: 'Supply Voltage', value: 416, unit: 'V' },  voltage: 416 },
  { id: 'dieselPump',         name: 'Diesel Pump',         status: 'critical', reading: { label: 'Supply Voltage', value: 0,   unit: 'V' },  voltage: 0 },
  { id: 'sprinklerPressure',  name: 'Sprinkler Pressure',  status: 'ok',       reading: { label: 'Line Pressure',  value: 6.5, unit: 'bar' } },
  { id: 'hydrantPressure',    name: 'Hydrant Pressure',    status: 'ok',       reading: { label: 'Line Pressure',  value: 5.8, unit: 'bar' } },
  { id: 'waterTank',          name: 'Water Tank',          status: 'warning',  reading: { label: 'Level',          value: 65,  unit: '%' }  },
  { id: 'dieselFuelTank',     name: 'DG Fuel Tank',        status: 'ok',       reading: { label: 'Level',          value: 72,  unit: '%' }  },
  { id: 'dgBattery',          name: 'DG Battery',          status: 'ok',       reading: { label: 'Voltage',        value: 12.6, unit: 'V' } },
  { id: 'fireAlarmPanel',     name: 'Fire Alarm Panel',    status: 'ok',       reading: { label: 'Panel Status',   value: 'NORMAL' } },
  { id: 'paSystem',           name: 'PA System',           status: 'ok',       reading: { label: 'Status',         value: 'ONLINE' } },
  { id: 'ventilation',        name: 'Ventilation',         status: 'ok',       reading: { label: 'Mode',           value: 'AUTO' } },
  { id: 'diModule',           name: 'DI Module',           status: 'ok',       reading: { label: 'Active Inputs',  value: '8 / 8' } },
  { id: 'doModule',           name: 'DO Module',           status: 'ok',       reading: { label: 'Active Outputs', value: '4 / 4' } },
]

// ─── Alarms ──────────────────────────────────────────────────────────────────
export const initialAlarms: AlarmItem[] = [
  {
    id: 'ALM001',
    severity: 'critical',
    device: 'Diesel Pump',
    parameter: 'Fault Detected',
    value: 'FAULT',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    acknowledged: false,
  },
  {
    id: 'ALM002',
    severity: 'warning',
    device: 'Water Tank',
    parameter: 'Level below 70% threshold',
    value: 65,
    unit: '%',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    acknowledged: false,
  },
  {
    id: 'ALM003',
    severity: 'info',
    device: 'Jockey Pump',
    parameter: 'Pump started (auto)',
    value: 'RUNNING',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    acknowledged: true,
    acknowledgedBy: 'admin@abctowers.com',
  },
]

// ─── Trend series — 24 hourly data points ────────────────────────────────────
function hourlyLabel(hoursAgo: number): string {
  const d = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function generateHourly(
  count: number,
  base: number,
  amplitude: number,
  trend: number = 0
): { time: string; value: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    time: hourlyLabel(count - 1 - i),
    value: parseFloat((base + trend * i / count + (Math.random() - 0.5) * amplitude).toFixed(2)),
  }))
}

export const trendSeries = [
  {
    id: 'sprinklerPressure',
    label: 'Sprinkler Pressure',
    unit: 'bar',
    color: '#6366F1',
    warningValue: 8,
    criticalValue: 10,
    data: generateHourly(24, 6.5, 0.8),
  },
  {
    id: 'waterTankLevel',
    label: 'Water Tank Level',
    unit: '%',
    color: '#22C55E',
    warningValue: 30,
    criticalValue: 15,
    data: generateHourly(24, 70, 3, -5),
  },
  {
    id: 'dgPower',
    label: 'DG Battery',
    unit: 'V',
    color: '#F59E0B',
    warningValue: 11.5,
    criticalValue: 10.5,
    data: generateHourly(24, 12.5, 0.4),
  },
]

// ─── Refresh hook ─────────────────────────────────────────────────────────────
function jitter(val: number, range: number): number {
  return parseFloat((val + (Math.random() - 0.5) * range).toFixed(2))
}

export function useRefreshCountdown(totalSeconds: number) {
  const [devices, setDevices] = useState<DeviceData[]>(initialDevices)
  const [alarms, setAlarms] = useState<AlarmItem[]>(initialAlarms)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const refresh = useCallback(() => {
    setLastUpdated(new Date())
    setDevices(prev => prev.map(d => {
      if (d.id === 'sprinklerPressure') return { ...d, reading: { ...d.reading, value: jitter(6.5, 0.6) } }
      if (d.id === 'hydrantPressure') return { ...d, reading: { ...d.reading, value: jitter(5.8, 0.5) } }
      if (d.id === 'dgBattery') return { ...d, reading: { ...d.reading, value: jitter(12.6, 0.2) } }
      return d
    }))
  }, [])

  useEffect(() => {
    const t = setInterval(refresh, totalSeconds * 1000)
    return () => clearInterval(t)
  }, [refresh, totalSeconds])

  const ackAlarm = useCallback((id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true, acknowledgedBy: 'admin@abctowers.com' } : a))
  }, [])

  return { devices, alarms, lastUpdated, refresh, ackAlarm }
}
