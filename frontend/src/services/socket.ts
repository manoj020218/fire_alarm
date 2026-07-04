import type { TelemetryPayload, Alarm } from '@/types';
import { MOCK_TELEMETRY } from '@/data/mockTelemetry';
import { MOCK_SOCKET_INTERVAL_MS } from '@/utils/constants';

type TelemetryHandler = (t: TelemetryPayload) => void;
type AlarmHandler = (a: Alarm) => void;

const telemetryHandlers = new Set<TelemetryHandler>();
const alarmHandlers = new Set<AlarmHandler>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let connected = false;

function jitter(base: number, variance: number): number {
  return parseFloat((base + (Math.random() - 0.5) * variance).toFixed(2));
}

function emitMockTelemetry(): void {
  const t: TelemetryPayload = {
    ...MOCK_TELEMETRY,
    timestamp: Math.floor(Date.now() / 1000),
    devices: {
      ...MOCK_TELEMETRY.devices,
      sprinklerPressure: { ...MOCK_TELEMETRY.devices.sprinklerPressure, value: jitter(6.5, 0.6) },
      hydrantPressure:   { ...MOCK_TELEMETRY.devices.hydrantPressure,   value: jitter(5.8, 0.5) },
      waterTankLevel:    { ...MOCK_TELEMETRY.devices.waterTankLevel,    value: jitter(65, 2) },
      dgFuelLevel:       { ...MOCK_TELEMETRY.devices.dgFuelLevel,       value: jitter(72, 0.5) },
      dgBattery:         { ...MOCK_TELEMETRY.devices.dgBattery,         value: jitter(12.6, 0.15) },
    },
  };
  telemetryHandlers.forEach((h) => h(t));
}

export const mockSocket = {
  connect(): void {
    if (connected) return;
    connected = true;
    intervalId = setInterval(emitMockTelemetry, MOCK_SOCKET_INTERVAL_MS);
    console.info('[MockSocket] connected — emitting telemetry every', MOCK_SOCKET_INTERVAL_MS, 'ms');
  },

  disconnect(): void {
    if (!connected) return;
    connected = false;
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    console.info('[MockSocket] disconnected');
  },

  onTelemetry(handler: TelemetryHandler): () => void {
    telemetryHandlers.add(handler);
    return () => telemetryHandlers.delete(handler);
  },

  onAlarm(handler: AlarmHandler): () => void {
    alarmHandlers.add(handler);
    return () => alarmHandlers.delete(handler);
  },

  isConnected(): boolean {
    return connected;
  },
};
