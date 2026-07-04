import type { TelemetryPayload, Site, Gateway, TrendPoint } from '@/types';

export const MOCK_SITES: Site[] = [
  {
    id: 'SITE001',
    name: 'ABC Towers',
    location: 'Mumbai',
    address: 'Bandra Kurla Complex, Mumbai, Maharashtra 400051',
    gatewayIds: ['JNX-FG-AB12'],
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'SITE002',
    name: 'DLF Corporate Park',
    location: 'Gurugram',
    address: 'Sector 25, Gurugram, Haryana 122002',
    gatewayIds: ['JNX-FG-CD34'],
    createdAt: '2026-02-10T08:00:00Z',
  },
];

export const MOCK_GATEWAY: Gateway = {
  id: 'JNX-FG-AB12',
  name: 'JNX-FG-AB12',
  siteId: 'SITE001',
  pid: 'FIREGUARD-S3-01',
  online: true,
  lastSeen: new Date().toISOString(),
  system: {
    wifi: 'online',
    mqtt: 'connected',
    cloud: 'online',
    rs485: 'ok',
    rssi: -58,
    uptime: 345600,
    fw: '1.0.0',
    releaseDate: '2026-07-01',
  },
};

export const MOCK_TELEMETRY: TelemetryPayload = {
  pid: 'FIREGUARD-S3-01',
  gatewayId: 'JNX-FG-AB12',
  siteId: 'SITE001',
  timestamp: Math.floor(Date.now() / 1000),
  system: {
    wifi: 'online',
    mqtt: 'connected',
    cloud: 'online',
    rs485: 'ok',
    rssi: -58,
    uptime: 345600,
    fw: '1.0.0',
    releaseDate: '2026-07-01',
  },
  devices: {
    jockeyPump:        { status: 'ON',     online: true  },
    mainPump1:         { status: 'OFF',    online: true  },
    mainPump2:         { status: 'OFF',    online: true  },
    dieselPump:        { status: 'OFF',    online: true  },
    sprinklerPressure: { value: 6.5,   unit: 'bar', online: true  },
    hydrantPressure:   { value: 5.8,   unit: 'bar', online: true  },
    waterTankLevel:    { value: 65,    unit: '%',   online: true  },
    dgFuelLevel:       { value: 72,    unit: '%',   online: true  },
    dgBattery:         { value: 12.6,  unit: 'V',   online: true  },
    fireAlarmPanel:    { status: 'NORMAL', online: true  },
    paSystem:          { status: 'NORMAL', online: true  },
    ventilation:       { status: 'ON',    online: true  },
  },
};

function generateTrendPoints(base: number, hours = 24, variance = 1): TrendPoint[] {
  const now = Date.now();
  return Array.from({ length: hours * 6 }, (_, i) => {
    const ts = new Date(now - (hours * 6 - i) * 600_000).toISOString();
    const value = parseFloat((base + (Math.random() - 0.5) * variance * 2).toFixed(2));
    return { ts, value };
  });
}

export const MOCK_TRENDS: Record<string, TrendPoint[]> = {
  sprinklerPressure: generateTrendPoints(6.5, 24, 0.5),
  hydrantPressure:   generateTrendPoints(5.8, 24, 0.4),
  waterTankLevel:    generateTrendPoints(65,  24, 3),
  dgFuelLevel:       generateTrendPoints(72,  24, 1),
  dgBattery:         generateTrendPoints(12.6, 24, 0.2),
};
