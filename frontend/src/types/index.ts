// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole =
  | 'JENIX_SUPER_ADMIN'
  | 'VENDOR_ADMIN'
  | 'CLIENT_ADMIN'
  | 'MAINTENANCE_USER'
  | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  siteIds: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

// ─── Site ─────────────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  name: string;
  location: string;
  address: string;
  gatewayIds: string[];
  createdAt: string;
}

// ─── Gateway ──────────────────────────────────────────────────────────────────

export type ConnStatus = 'online' | 'offline' | 'unknown';
export type MqttStatus = 'connected' | 'disconnected' | 'unknown';

export interface GatewaySystem {
  wifi: ConnStatus;
  mqtt: MqttStatus;
  cloud: ConnStatus;
  rs485: 'ok' | 'error' | 'unknown';
  rssi: number;
  uptime: number;
  fw: string;
  releaseDate: string;
}

export interface Gateway {
  id: string;
  name: string;
  siteId: string;
  pid: string;
  online: boolean;
  lastSeen: string;
  system: GatewaySystem;
}

// ─── Equipment / Devices ──────────────────────────────────────────────────────

export type EquipmentStatus = 'ON' | 'OFF' | 'FAULT' | 'NORMAL' | 'ALARM' | 'UNKNOWN';

export interface PumpDevice {
  status: EquipmentStatus;
  online: boolean;
  faultCode?: string;
}

export interface SensorDevice {
  value: number;
  unit: string;
  online: boolean;
}

export interface PanelDevice {
  status: EquipmentStatus;
  online: boolean;
}

export interface EquipmentDevices {
  jockeyPump: PumpDevice;
  mainPump1: PumpDevice;
  mainPump2: PumpDevice;
  dieselPump: PumpDevice;
  sprinklerPressure: SensorDevice;
  hydrantPressure: SensorDevice;
  waterTankLevel: SensorDevice;
  dgFuelLevel: SensorDevice;
  dgBattery: SensorDevice;
  fireAlarmPanel: PanelDevice;
  paSystem: PanelDevice;
  ventilation: PumpDevice;
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface TelemetryPayload {
  pid: string;
  gatewayId: string;
  siteId: string;
  timestamp: number;
  system: GatewaySystem;
  devices: EquipmentDevices;
}

// ─── Alarms ───────────────────────────────────────────────────────────────────

export type AlarmSeverity = 'warning' | 'critical';

export interface Alarm {
  id: string;
  siteId: string;
  gatewayId: string;
  deviceId: keyof EquipmentDevices;
  parameter: string;
  value: number | string;
  severity: AlarmSeverity;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  acknowledgeReason?: string;
}

// ─── Dashboard Snapshot ───────────────────────────────────────────────────────

export interface DashboardSummary {
  systemStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
  devicesOnline: number;
  devicesTotal: number;
  activeAlarms: number;
  acknowledgedAlarms: number;
  unacknowledgedAlarms: number;
}

// ─── Register Map ─────────────────────────────────────────────────────────────

export interface RegisterEntry {
  deviceId: string;
  deviceName: string;
  slaveId: number;
  register: number;
  functionCode: 3 | 4;
  parameter: string;
  unit: string;
  scale: number;
  online: boolean;
  lastValue: number | string;
}

// ─── Maintenance Log ──────────────────────────────────────────────────────────

export interface MaintenanceLog {
  id: string;
  siteId: string;
  deviceId: string;
  deviceName: string;
  type: 'preventive' | 'corrective' | 'inspection';
  description: string;
  performedBy: string;
  performedAt: string;
  nextDueDate?: string;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface Report {
  id: string;
  siteId: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  format: 'pdf' | 'excel' | 'csv';
  generatedAt: string;
  generatedBy: string;
  url?: string;
}

// ─── Trend Point ──────────────────────────────────────────────────────────────

export interface TrendPoint {
  ts: string;
  value: number;
}
