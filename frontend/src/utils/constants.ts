export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  LIVE_MONITOR: '/live-monitor',
  ALARMS: '/alarms',
  TRENDS: '/trends',
  REPORTS: '/reports',
  DEVICES: '/devices',
  MAINTENANCE: '/maintenance',
  USERS: '/users',
  SETTINGS: '/settings',
  API_INTEGRATION: '/api-integration',
} as const;

export const STATUS_COLORS = {
  ON: 'text-brand-green',
  OFF: 'text-slate-400',
  FAULT: 'text-brand-red',
  NORMAL: 'text-brand-green',
  ALARM: 'text-brand-red',
  UNKNOWN: 'text-slate-400',
  online: 'text-brand-green',
  offline: 'text-brand-red',
  ok: 'text-brand-green',
  error: 'text-brand-red',
  warning: 'text-brand-amber',
  critical: 'text-brand-red',
} as const;

export const STATUS_BG = {
  ON: 'bg-green-100 text-green-700',
  OFF: 'bg-slate-100 text-slate-500',
  FAULT: 'bg-red-100 text-red-700',
  NORMAL: 'bg-green-100 text-green-700',
  ALARM: 'bg-red-100 text-red-700',
  UNKNOWN: 'bg-slate-100 text-slate-400',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
  online: 'bg-green-100 text-green-700',
  offline: 'bg-red-100 text-red-700',
} as const;

export const EQUIPMENT_LABELS: Record<string, string> = {
  jockeyPump: 'Jockey Pump',
  mainPump1: 'Main Pump 1',
  mainPump2: 'Main Pump 2',
  dieselPump: 'Diesel Pump',
  sprinklerPressure: 'Sprinkler Line',
  hydrantPressure: 'Hydrant Line',
  waterTankLevel: 'Water Tank',
  dgFuelLevel: 'DG Fuel',
  dgBattery: 'DG Battery',
  fireAlarmPanel: 'Fire Panel',
  paSystem: 'PA System',
  ventilation: 'Ventilation',
};

export const SEVERITY_BADGE = {
  warning: 'bg-amber-100 text-amber-700 border border-amber-200',
  critical: 'bg-red-100 text-red-700 border border-red-200',
} as const;

export const MOCK_SOCKET_INTERVAL_MS = 8000;

export const DEMO_SITE_ID = 'SITE001';
export const DEMO_GATEWAY_ID = 'JNX-FG-AB12';
