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
  /** false = trial hasn't started yet (no gateway activated) */
  trialStarted?: boolean
}

export interface SubscriptionResponse {
  ok: boolean
  subscription: SubscriptionInfo
}

// ── Gateway ───────────────────────────────────────────────────────────────────

export interface GatewaySmsConfig {
  enabled: boolean
  numbers: string
  operator?: string
  balanceUssd?: string
  numberUssd?: string
}

export interface SimInboxItem {
  from?: string
  text: string
  ts?: string
}

export interface GatewaySim {
  iccid?: string
  imsi?: string
  number?: string
  operator?: string
  signal?: number
  registered?: boolean
  canSend?: boolean
  balanceText?: string
  messages?: SimInboxItem[]
  lastCheckedAt?: string
}

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
  smsConfig?: GatewaySmsConfig
  sim?: GatewaySim
}

/** Live 'sim' socket event payload from the gateway. */
export interface SimEvent extends GatewaySim {
  gatewayId: string
  type?: 'sim_info' | 'sms_list' | 'ussd' | 'test_sms'
  ok?: boolean
  error?: string
  at?: string
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

// ── Add-Gateway (claim) ─────────────────────────────────────────────────────────

export interface ClaimGatewayPayload {
  gatewayId: string
  claimCode: string
  name?: string
  siteId?: string
}

export interface ClaimGatewayResponse {
  ok: boolean
  gateway: GatewayItem
}

// ── Reports ───────────────────────────────────────────────────────────────────

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom' | 'alarm_summary'

export interface ReportItem {
  _id: string
  siteId: string
  type: ReportType
  format: 'pdf' | 'csv' | 'excel'
  status: 'pending' | 'generating' | 'ready' | 'failed'
  requestedAt: string
  rangeFrom: string
  rangeTo: string
  fileSize?: number
  error?: string
}

export interface ReportsResponse {
  ok: boolean
  reports: ReportItem[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface UserItem {
  _id: string
  id?: string
  email: string
  name: string
  role: string
  siteIds: string[]
  active?: boolean
  lastLoginAt?: string
  createdAt?: string
}

export interface UsersResponse {
  ok: boolean
  users: UserItem[]
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
  trialEndsAt: string | null
  trialNote?: string
}

export interface SignupError {
  ok: false
  error: string
}

export type SignupResponse = SignupSuccess | SignupError
