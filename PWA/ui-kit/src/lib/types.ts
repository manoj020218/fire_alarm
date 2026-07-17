/**
 * TypeScript types for the FireGuard API response shapes.
 * These mirror the backend Mongoose model interfaces.
 */

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  siteIds: string[]
  lastLoginAt?: string
}

export interface LoginResponse {
  ok: boolean
  accessToken: string
  refreshToken: string
  user: AuthUser
}

// ── Subscription ──────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'grace'

export interface SubscriptionInfo {
  siteId?: string
  status: SubscriptionStatus
  daysLeft: number | null
}

export interface SubscriptionResponse {
  ok: boolean
  subscription: SubscriptionInfo
}

// ── Gateway ───────────────────────────────────────────────────────────────────

export interface GatewayItem {
  gatewayId: string
  siteId: string
  name: string
  fw: string
  hw: string
  lastSeenAt?: string
  online: boolean
  uplink?: 'wifi' | 'lan' | '4g'
  rssi?: number
  signal4g?: number
  uptime?: number
}

export interface GatewaysResponse {
  ok: boolean
  gateways: GatewayItem[]
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

export interface DeviceReading {
  value?: number
  status?: string
  online: boolean
  unit?: string
}

export interface SystemHealth {
  uptime: number
  heap: number
  fw: string
  releaseDate: string
  uplink: 'wifi' | 'lan' | '4g'
  signal4g?: number
  signalLan?: boolean
  rssi?: number
  mqtt: 'connected' | 'disconnected'
  cloud: 'online' | 'offline'
  rs485: 'ok' | 'error'
  wifi: 'online' | 'offline'
}

export interface DigitalInputs {
  di0?: boolean
  di1?: boolean
  di2?: boolean
  di3?: boolean
}

export interface DigitalOutputs {
  do0?: boolean
  do1?: boolean
}

export interface TelemetryDoc {
  _id: string
  gatewayId: string
  siteId: string
  pid: string
  deviceTs: number
  timestamp: string
  system: SystemHealth
  devices: Record<string, DeviceReading>
  digitalInputs?: DigitalInputs
  digitalOutputs?: DigitalOutputs
  source: 'mqtt' | 'http'
}

export interface TelemetryLatestResponse {
  ok: boolean
  telemetry: TelemetryDoc
}

// ── Alarms ────────────────────────────────────────────────────────────────────

export type AlarmSeverity = 'warning' | 'critical'

export interface AlarmDoc {
  _id: string
  alarmId: string
  siteId: string
  gatewayId: string
  deviceId: string
  parameter: string
  value: number | string
  severity: AlarmSeverity
  timestamp: string
  active: boolean
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: string
  acknowledgeReason?: string
  source: 'mqtt' | 'http'
}

export interface AlarmsResponse {
  ok: boolean
  alarms: AlarmDoc[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// ── Public signup ─────────────────────────────────────────────────────────────

export interface SignupPayload {
  companyName: string
  contactName: string
  phone: string
  email: string
}

export interface SignupSuccess {
  ok: true
  email: string
  tempPassword: string
  loginUrl: string
  trialEndsAt: string
}

export interface SignupError {
  ok: false
  error: string
}

export type SignupResponse = SignupSuccess | SignupError
