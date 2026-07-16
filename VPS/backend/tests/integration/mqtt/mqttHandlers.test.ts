/**
 * Integration tests for MQTT handlers.
 * Calls handler functions directly (no real broker needed).
 * Verifies DB writes, Gateway updates, alarm upsert idempotency, malformed-payload safety.
 */
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { Gateway } from '../../../src/models/Gateway';
import { Telemetry } from '../../../src/models/Telemetry';
import { Alarm } from '../../../src/models/Alarm';
import { handleTelemetry, handleStatus, handleAlarm } from '../../../src/mqtt/mqttHandlers';

// ── Mock Socket.IO emitters so we don't need a real server ─────────────────────
jest.mock('../../../src/socket/socketServer', () => ({
  emitTelemetry: jest.fn(),
  emitAlarm: jest.fn(),
  emitGatewayStatus: jest.fn(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GATEWAY_ID = 'JNX-FG-TEST';
const SITE_ID = 'SITE001';

const telemetryPayload = {
  pid: 'FIREGUARD-S3-01',
  gatewayId: GATEWAY_ID,
  siteId: SITE_ID,
  timestamp: Math.floor(Date.now() / 1000),
  system: {
    uptime: 3600,
    heap: 200000,
    fw: '1.0.0',
    releaseDate: '2026-07-01',
    uplink: 'wifi',
    rssi: -65,
    mqtt: 'connected',
    cloud: 'online',
    rs485: 'ok',
    wifi: 'online',
  },
  devices: {
    sprinklerPressure: { value: 4.2, online: true },
    firePanel: { status: 'NORMAL', online: true },
    digitalInputs: { di0: false, di1: true, di2: false, di3: false },
    digitalOutputs: { do0: true, do1: false },
  },
};

const statusPayload = {
  gatewayId: GATEWAY_ID,
  siteId: SITE_ID,
  online: true,
  fw: '1.0.0',
  uplink: 'wifi' as const,
  uptime: 7200,
  heap: 190000,
  rssi: -62,
};

const alarmPayload = {
  alarmId: 'ALM-MQTT-001',
  siteId: SITE_ID,
  gatewayId: GATEWAY_ID,
  deviceId: 'sprinklerPressure',
  parameter: 'pressure_low',
  value: 1.5,
  severity: 'warning' as const,
  timestamp: Math.floor(Date.now() / 1000),
  active: true,
};

function toBuffer(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj));
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await connectTestDB();
  // Seed a gateway so findOneAndUpdate (upsert:false) can update it
  await Gateway.create({
    gatewayId: GATEWAY_ID,
    siteId: SITE_ID,
    name: 'Test Gateway',
    fw: '0.9.0',
    hw: 'vvm401',
    online: false,
    deviceToken: 'test-token',
  });
});

afterAll(async () => { await disconnectTestDB(); });

afterEach(async () => {
  // Clear derived collections but keep the gateway
  await Telemetry.deleteMany({});
  await Alarm.deleteMany({});
});

// ── Telemetry tests ───────────────────────────────────────────────────────────

describe('handleTelemetry', () => {
  it('inserts a Telemetry doc', async () => {
    await handleTelemetry(toBuffer(telemetryPayload));
    const count = await Telemetry.countDocuments({ gatewayId: GATEWAY_ID });
    expect(count).toBe(1);
  });

  it('updates Gateway lastSeenAt and online=true', async () => {
    await handleTelemetry(toBuffer(telemetryPayload));
    const gw = await Gateway.findOne({ gatewayId: GATEWAY_ID });
    expect(gw?.online).toBe(true);
    expect(gw?.lastSeenAt).toBeDefined();
    expect(gw?.fw).toBe('1.0.0');
    expect(gw?.uplink).toBe('wifi');
  });

  it('sets source=mqtt by default', async () => {
    await handleTelemetry(toBuffer(telemetryPayload));
    const doc = await Telemetry.findOne({ gatewayId: GATEWAY_ID });
    expect(doc?.source).toBe('mqtt');
  });

  it('sets source=http when passed explicitly', async () => {
    await handleTelemetry(toBuffer(telemetryPayload), 'http');
    const doc = await Telemetry.findOne({ gatewayId: GATEWAY_ID });
    expect(doc?.source).toBe('http');
  });

  it('drops invalid JSON without throwing', async () => {
    await expect(handleTelemetry(Buffer.from('not json'))).resolves.toBeUndefined();
    const count = await Telemetry.countDocuments({});
    expect(count).toBe(0);
  });

  it('drops schema-invalid payload without throwing', async () => {
    const bad = { ...telemetryPayload, system: undefined };
    await expect(handleTelemetry(toBuffer(bad))).resolves.toBeUndefined();
    const count = await Telemetry.countDocuments({});
    expect(count).toBe(0);
  });

  it('tolerates extra unknown fields in payload', async () => {
    const extra = { ...telemetryPayload, unknownField: 'ignored' };
    await expect(handleTelemetry(toBuffer(extra))).resolves.toBeUndefined();
    const count = await Telemetry.countDocuments({ gatewayId: GATEWAY_ID });
    expect(count).toBe(1);
  });
});

// ── Status tests ──────────────────────────────────────────────────────────────

describe('handleStatus', () => {
  it('updates gateway heartbeat fields', async () => {
    await handleStatus(toBuffer(statusPayload));
    const gw = await Gateway.findOne({ gatewayId: GATEWAY_ID });
    expect(gw?.online).toBe(true);
    expect(gw?.uptime).toBe(7200);
    expect(gw?.heap).toBe(190000);
  });

  it('drops invalid JSON without throwing', async () => {
    await expect(handleStatus(Buffer.from('{bad'))).resolves.toBeUndefined();
  });

  it('drops schema-invalid payload without throwing', async () => {
    await expect(handleStatus(toBuffer({ noGatewayId: true }))).resolves.toBeUndefined();
  });
});

// ── Alarm tests ───────────────────────────────────────────────────────────────

describe('handleAlarm', () => {
  it('stores an alarm doc', async () => {
    await handleAlarm(toBuffer(alarmPayload));
    const count = await Alarm.countDocuments({ alarmId: alarmPayload.alarmId });
    expect(count).toBe(1);
  });

  it('is idempotent — resending the same alarmId does not create a duplicate', async () => {
    await handleAlarm(toBuffer(alarmPayload));
    await handleAlarm(toBuffer(alarmPayload));
    const count = await Alarm.countDocuments({ alarmId: alarmPayload.alarmId });
    expect(count).toBe(1);
  });

  it('updates severity on resend with changed severity', async () => {
    await handleAlarm(toBuffer(alarmPayload));
    const updated = { ...alarmPayload, severity: 'critical' as const };
    await handleAlarm(toBuffer(updated));
    const doc = await Alarm.findOne({ alarmId: alarmPayload.alarmId });
    expect(doc?.severity).toBe('critical');
  });

  it('drops invalid JSON without throwing', async () => {
    await expect(handleAlarm(Buffer.from('{{'))).resolves.toBeUndefined();
    const count = await Alarm.countDocuments({});
    expect(count).toBe(0);
  });

  it('drops schema-invalid payload without throwing', async () => {
    const bad = { alarmId: 'X' }; // missing required fields
    await expect(handleAlarm(toBuffer(bad))).resolves.toBeUndefined();
    const count = await Alarm.countDocuments({});
    expect(count).toBe(0);
  });

  it('sets source=http when passed explicitly', async () => {
    await handleAlarm(toBuffer(alarmPayload), 'http');
    const doc = await Alarm.findOne({ alarmId: alarmPayload.alarmId });
    expect(doc?.source).toBe('http');
  });
});
