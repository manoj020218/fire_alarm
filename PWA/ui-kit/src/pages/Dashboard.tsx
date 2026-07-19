/**
 * Dashboard — live data from the real backend.
 * Fetches: subscription, gateways, telemetry, alarms.
 * Socket.IO live updates for telemetry/alarm/gateway-status events.
 * Falls back to 30s polling if socket is disconnected.
 * Empty state when no gateways are provisioned yet.
 */
import { useEffect, useState, useCallback, useRef, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket'
import {
  mapTelemetryToDevices,
  mapAlarms,
  mapConnections,
  formatUptime,
  formatLastSeen,
  formatSignal,
} from '../lib/mapper'
import type {
  SubscriptionInfo,
  GatewayItem,
  TelemetryDoc,
  AlarmDoc,
  AlarmsResponse,
  GatewaysResponse,
  TelemetryLatestResponse,
  SubscriptionResponse,
} from '../lib/types'
import type { DeviceData } from '../data/mockData'
import type { AlarmItem } from '../components/ui/AlarmRow'
import type { Status } from '../lib/utils'

import AppShell from '../components/ui/AppShell'
import SectionCard from '../components/ui/SectionCard'
import KpiTile from '../components/ui/KpiTile'
import EquipmentCard from '../components/ui/EquipmentCard'
import RadialGauge from '../components/ui/RadialGauge'
import TankGauge from '../components/ui/TankGauge'
import AiInsightCard from '../components/ui/AiInsightCard'
import ConnectionStrip from '../components/ui/ConnectionStrip'
import AlarmTable from '../components/ui/AlarmTable'
import Button from '../components/ui/Button'

import PumpIcon from '../components/icons/PumpIcon'
import PressureIcon from '../components/icons/PressureIcon'
import TankIcon from '../components/icons/TankIcon'
import FuelIcon from '../components/icons/FuelIcon'
import BatteryIcon from '../components/icons/BatteryIcon'
import FirePanelIcon from '../components/icons/FirePanelIcon'
import PaSystemIcon from '../components/icons/PaSystemIcon'
import VentilationIcon from '../components/icons/VentilationIcon'
import GatewayIcon from '../components/icons/GatewayIcon'
import axios from 'axios'

// ── Icon map ──────────────────────────────────────────────────────────────────
const deviceIconMap: Record<string, ReactElement> = {
  jockeyPump:        <PumpIcon size={20} />,
  mainPump1:         <PumpIcon size={20} />,
  mainPump2:         <PumpIcon size={20} />,
  dieselPump:        <PumpIcon size={20} />,
  sprinklerPressure: <PressureIcon size={20} />,
  hydrantPressure:   <PressureIcon size={20} />,
  waterTank:         <TankIcon size={20} />,
  dieselFuelTank:    <FuelIcon size={20} />,
  dgBattery:         <BatteryIcon size={20} />,
  fireAlarmPanel:    <FirePanelIcon size={20} />,
  paSystem:          <PaSystemIcon size={20} />,
  ventilation:       <VentilationIcon size={20} />,
  diModule:          <GatewayIcon size={20} />,
  doModule:          <GatewayIcon size={20} />,
}

// ── StatusIcon helper ─────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: Status }) {
  if (status === 'critical' || status === 'offline') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    )
  }
  if (status === 'warning') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"/><polyline points="9,12 12,15 16,10"/>
    </svg>
  )
}

// ── Subscription banner ───────────────────────────────────────────────────────
function SubscriptionBanner({ sub }: { sub: SubscriptionInfo }) {
  if (sub.status === 'active') return null

  // Trial hasn't started yet — starts when the first gateway is activated.
  if (sub.status === 'trial' && sub.trialStarted === false) {
    return (
      <div className="mb-5 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/></svg>
        <span>Your <strong>3-month free trial</strong> starts as soon as you add your first gateway.</span>
      </div>
    )
  }

  if (sub.status === 'trial' && sub.daysLeft !== null) {
    return (
      <div className="mb-5 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800 flex items-center justify-between">
        <span>Trial active — <strong>{sub.daysLeft} day{sub.daysLeft === 1 ? '' : 's'} remaining</strong></span>
      </div>
    )
  }

  if (sub.status === 'expired') {
    return (
      <div className="mb-5 px-4 py-3 bg-red-50 border border-red-300 rounded-xl text-sm text-red-800 flex flex-wrap items-center justify-between gap-3">
        <span className="font-semibold">Subscription expired — monitoring is still active</span>
        <a
          href="https://wa.me/917240226566"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
        >
          Renew via WhatsApp →
        </a>
      </div>
    )
  }

  if (sub.status === 'grace') {
    return (
      <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-800 flex flex-wrap items-center justify-between gap-3">
        <span>Subscription in grace period — <strong>{sub.daysLeft ?? 0} day{(sub.daysLeft ?? 0) === 1 ? '' : 's'} left</strong> to renew</span>
        <a
          href="https://wa.me/917240226566"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
        >
          Renew via WhatsApp →
        </a>
      </div>
    )
  }

  return null
}

// ── ACK modal ─────────────────────────────────────────────────────────────────
function AckModal({ alarmId, onConfirm, onCancel }: { alarmId: string; onConfirm: (id: string, reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <h3 className="text-base font-bold text-slate-800 mb-2">Acknowledge alarm</h3>
        <p className="text-sm text-slate-500 mb-4">Briefly describe the action taken (optional).</p>
        <textarea
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
          rows={3}
          placeholder="e.g. Inspected pump, restarted manually."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" size="sm" className="flex-1 justify-center" onClick={() => onConfirm(alarmId, reason)}>Acknowledge</Button>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyGateway() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
          <GatewayIcon size={36} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">No gateway connected yet</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          Install your FireGuard Gateway in the pump room and wire it to your equipment. Once it connects to the cloud, your live dashboard will appear here automatically.
        </p>
        <p className="text-xs text-slate-400 mt-4">
          Need help? WhatsApp us at{' '}
          <a href="https://wa.me/917240226566" className="text-indigo-500 hover:underline">+91 72402 26566</a>
        </p>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { user, siteId, logout } = useAuth()

  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [gateway, setGateway] = useState<GatewayItem | null>(null)
  const [telemetry, setTelemetry] = useState<TelemetryDoc | null>(null)
  const [alarmDocs, setAlarmDocs] = useState<AlarmDoc[]>([])
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [ackModalId, setAckModalId] = useState<string | null>(null)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch all dashboard data ────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    if (!siteId) return
    try {
      const [subRes, gwRes] = await Promise.all([
        api.get<SubscriptionResponse>('/subscription'),
        api.get<GatewaysResponse>('/gateways'),
      ])
      setSubscription(subRes.data.subscription)

      const siteGateways = gwRes.data.gateways.filter((g) => g.siteId === siteId)
      const gw = siteGateways[0] ?? null
      setGateway(gw)

      if (gw) {
        const [telRes, alarmRes] = await Promise.all([
          api.get<TelemetryLatestResponse>(`/telemetry/${gw.gatewayId}/latest`),
          api.get<AlarmsResponse>('/alarms', { params: { siteId, limit: 20, page: 1 } }),
        ])
        setTelemetry(telRes.data.telemetry)
        setAlarmDocs(alarmRes.data.alarms)
      } else {
        // No gateway — fetch alarms anyway (may be empty)
        const alarmRes = await api.get<AlarmsResponse>('/alarms', { params: { siteId, limit: 20, page: 1 } })
        setAlarmDocs(alarmRes.data.alarms)
      }

      setLastUpdated(new Date())
      setFetchError(null)
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        // No telemetry yet — not an error
        setFetchError(null)
      } else {
        setFetchError('Could not load dashboard data. Retrying...')
      }
    } finally {
      setLoading(false)
    }
  }, [siteId])

  // ── Initial load + polling ──────────────────────────────────────────────────
  useEffect(() => {
    void fetchDashboard()

    // 30s polling fallback (overridden by socket events)
    pollingRef.current = setInterval(() => {
      const sock = getSocket()
      if (!sock?.connected) {
        void fetchDashboard()
      }
    }, 30_000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchDashboard])

  // ── Socket.IO live updates ──────────────────────────────────────────────────
  useEffect(() => {
    if (!siteId) return
    const token = localStorage.getItem('fg_token')
    if (!token) return

    const socket = connectSocket(token, siteId)

    socket.on('telemetry', (data: TelemetryDoc) => {
      setTelemetry(data)
      setLastUpdated(new Date())
    })

    socket.on('alarm', (data: AlarmDoc) => {
      setAlarmDocs((prev) => {
        const exists = prev.some((a) => a._id === data._id)
        if (exists) return prev.map((a) => (a._id === data._id ? data : a))
        return [data, ...prev].slice(0, 20)
      })
    })

    socket.on('gateway-status', (data: { gatewayId: string; online: boolean; lastSeenAt?: string }) => {
      setGateway((prev) =>
        prev && prev.gatewayId === data.gatewayId
          ? { ...prev, online: data.online, lastSeenAt: data.lastSeenAt }
          : prev
      )
    })

    return () => {
      disconnectSocket()
    }
  }, [siteId])

  // ── ACK alarm ──────────────────────────────────────────────────────────────
  async function confirmAck(id: string, reason: string) {
    setAckModalId(null)
    try {
      await api.post(`/alarms/${id}/ack`, { reason })
      setAlarmDocs((prev) =>
        prev.map((a) =>
          a._id === id ? { ...a, acknowledged: true, acknowledgedBy: user?.email, active: false } : a
        )
      )
    } catch {
      // silent — alarm will re-sync on next poll
    }
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const devices: DeviceData[] = telemetry ? mapTelemetryToDevices(telemetry) : []
  const alarms: AlarmItem[] = mapAlarms(alarmDocs)
  const connections = telemetry ? mapConnections(telemetry.system) : []

  const unackedCount = alarms.filter((a) => !a.acknowledged).length
  const onlineCount = devices.filter((d) => d.status !== 'critical' && d.status !== 'offline').length

  const waterTank = devices.find((d) => d.id === 'waterTank')
  const fuelTank = devices.find((d) => d.id === 'dieselFuelTank')
  const sprinkler = devices.find((d) => d.id === 'sprinklerPressure')
  const hydrant = devices.find((d) => d.id === 'hydrantPressure')

  const pumpDevices = devices.filter((d) => ['jockeyPump', 'mainPump1', 'mainPump2', 'dieselPump'].includes(d.id))
  const statusCards = devices.filter((d) => ['fireAlarmPanel', 'paSystem', 'ventilation'].includes(d.id))
  const otherCards = devices.filter((d) => ['dgBattery', 'diModule', 'doModule'].includes(d.id))

  const overallStatus: Status = alarms.some((a) => a.severity === 'critical' && !a.acknowledged)
    ? 'critical'
    : alarms.some((a) => a.severity === 'warning' && !a.acknowledged)
    ? 'warning'
    : 'ok'

  const siteName = user?.name ?? 'FireGuard'

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell currentPath="/dashboard" siteName={siteName} userName={user?.name ?? 'Admin'} onNavigate={navigate} onRefresh={() => void fetchDashboard()}>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm text-slate-500">Loading dashboard...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      currentPath="/dashboard"
      alarmCount={unackedCount}
      siteName={siteName}
      userName={user?.name ?? 'Admin'}
      onNavigate={(path) => {
        if (path === '/logout') { logout(); return }
        navigate(path)
      }}
      onRefresh={() => void fetchDashboard()}
    >
      {/* Error banner */}
      {fetchError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          <span>{fetchError}</span>
          <button onClick={() => void fetchDashboard()} className="text-xs underline ml-3">Retry</button>
        </div>
      )}

      {/* Subscription banner */}
      {subscription && <SubscriptionBanner sub={subscription} />}

      {/* Empty state: no gateway */}
      {!gateway && !loading ? (
        <EmptyGateway />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{siteName}</h1>
              <p className="text-sm text-slate-500">
                Gateway: {gateway?.gatewayId ?? '—'} · {gateway?.name ?? 'Pump Room'}
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            <KpiTile
              icon={<StatusIcon status={overallStatus} />}
              label="System Status"
              value={overallStatus === 'ok' ? 'Normal' : overallStatus === 'warning' ? 'Warning' : 'CRITICAL'}
              status={overallStatus}
            />
            <KpiTile
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
              label="Devices Online"
              value={devices.length ? `${onlineCount}/${devices.length}` : '—'}
              status={!devices.length ? 'idle' : onlineCount >= devices.length - 1 ? 'ok' : 'warning'}
              subtext={devices.length ? `${devices.length - onlineCount} with fault` : 'No data yet'}
            />
            <KpiTile
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
              label="Active Alarms"
              value={unackedCount}
              status={unackedCount === 0 ? 'ok' : alarms.some((a) => a.severity === 'critical' && !a.acknowledged) ? 'critical' : 'warning'}
              subtext={unackedCount === 0 ? 'All clear' : `${unackedCount} unacknowledged`}
            />
            <KpiTile
              icon={<TankIcon size={20} />}
              label="Water Tank"
              value={waterTank ? (waterTank.reading.value as number) : '--'}
              unit={waterTank ? '%' : undefined}
              status={!waterTank ? 'idle' : (waterTank.reading.value as number) < 30 ? 'critical' : (waterTank.reading.value as number) < 70 ? 'warning' : 'ok'}
            />
            <KpiTile
              icon={<FuelIcon size={20} />}
              label="DG Fuel"
              value={fuelTank ? (fuelTank.reading.value as number) : '--'}
              unit={fuelTank ? '%' : undefined}
              status={!fuelTank ? 'idle' : (fuelTank.reading.value as number) < 25 ? 'critical' : (fuelTank.reading.value as number) < 50 ? 'warning' : 'ok'}
            />
          </div>

          {/* AI Insight */}
          <AiInsightCard
            status={overallStatus}
            insight={
              overallStatus === 'critical'
                ? 'CRITICAL: One or more devices have reported a fault. Immediate inspection required. Check fuel, starter motors, and battery connections.'
                : overallStatus === 'warning'
                ? 'Warning: One or more parameters are outside normal thresholds. Review the alarm table and schedule maintenance.'
                : 'All fire systems operating normally. Sprinkler and hydrant pressures are within spec. Water storage is adequate. No action required.'
            }
            timestamp={lastUpdated}
            className="mb-5"
          />

          {/* Main grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
            {/* Equipment — 2/3 width */}
            <div className="xl:col-span-2 space-y-5">
              {pumpDevices.length > 0 && (
                <SectionCard title="Pump Room" accent="#6366F1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {pumpDevices.map((d) => (
                      <EquipmentCard
                        key={d.id}
                        icon={deviceIconMap[d.id]}
                        name={d.name}
                        status={d.status}
                        reading={d.reading}
                      />
                    ))}
                  </div>
                </SectionCard>
              )}

              {(sprinkler || hydrant) && (
                <SectionCard title="Line Pressures" accent="#22C55E">
                  <div className="flex flex-wrap gap-8 justify-around py-2">
                    {sprinkler && (
                      <RadialGauge
                        value={parseFloat(String(sprinkler.reading.value))}
                        max={12}
                        unit="bar"
                        label="Sprinkler"
                        warningThreshold={8}
                        criticalThreshold={10}
                        size={160}
                      />
                    )}
                    {hydrant && (
                      <RadialGauge
                        value={parseFloat(String(hydrant.reading.value))}
                        max={12}
                        unit="bar"
                        label="Hydrant"
                        warningThreshold={8}
                        criticalThreshold={10}
                        size={160}
                      />
                    )}
                  </div>
                </SectionCard>
              )}

              {(waterTank || fuelTank) && (
                <SectionCard title="Storage Tanks" accent="#F59E0B">
                  <div className="flex flex-wrap gap-10 justify-around py-4">
                    {waterTank && (
                      <TankGauge
                        percent={waterTank.reading.value as number}
                        capacityLabel="Total capacity"
                        label="Water Tank"
                        fluidType="water"
                        height={140}
                      />
                    )}
                    {fuelTank && (
                      <TankGauge
                        percent={fuelTank.reading.value as number}
                        capacityLabel="Total capacity"
                        label="DG Fuel Tank"
                        fluidType="diesel"
                        height={140}
                      />
                    )}
                  </div>
                </SectionCard>
              )}
            </div>

            {/* Right panel */}
            <div className="space-y-5">
              {/* Gateway status */}
              {gateway && (
                <SectionCard title="Gateway Status" accent="#6366F1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <GatewayIcon size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{gateway.gatewayId}</p>
                      <p className="text-xs text-slate-500">{gateway.name} · FW {gateway.fw}</p>
                    </div>
                    <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${gateway.online ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                      {gateway.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  {telemetry && (
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between"><span>Uptime</span><span className="font-medium text-slate-800">{formatUptime(telemetry.system.uptime)}</span></div>
                      <div className="flex justify-between"><span>Signal</span><span className="font-medium text-slate-800">{formatSignal(gateway)}</span></div>
                      <div className="flex justify-between"><span>FW Version</span><span className="font-medium text-slate-800">v{gateway.fw}</span></div>
                      <div className="flex justify-between"><span>Last Seen</span><span className={`font-medium ${gateway.online ? 'text-green-600' : 'text-red-500'}`}>{formatLastSeen(gateway.lastSeenAt)}</span></div>
                    </div>
                  )}
                </SectionCard>
              )}

              {/* Communication links */}
              {connections.length > 0 && (
                <SectionCard title="Communication Links" accent="#22C55E">
                  <ConnectionStrip connections={connections} layout="grid" />
                </SectionCard>
              )}

              {/* System devices */}
              {(statusCards.length > 0 || otherCards.length > 0) && (
                <SectionCard title="System Devices" accent="#94A3B8">
                  <div className="space-y-2">
                    {[...statusCards, ...otherCards].map((d) => (
                      <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{deviceIconMap[d.id] ?? <GatewayIcon size={16} />}</span>
                          <span className="text-xs font-medium text-slate-700">{d.name}</span>
                        </div>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: d.status === 'ok' ? '#22C55E' : d.status === 'warning' ? '#F59E0B' : '#EF4444' }}
                        >
                          {d.reading.value}{d.reading.unit ? ` ${d.reading.unit}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          </div>

          {/* Alarm table */}
          <AlarmTable
            alarms={alarms}
            onAck={(id) => setAckModalId(id)}
          />
        </>
      )}

      {/* ACK modal */}
      {ackModalId && (
        <AckModal
          alarmId={ackModalId}
          onConfirm={(id, reason) => void confirmAck(id, reason)}
          onCancel={() => setAckModalId(null)}
        />
      )}
    </AppShell>
  )
}
