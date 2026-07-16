/**
 * Integration tests for the device HTTP contract routes (/api/fireguard).
 * Tests: deviceAuth (valid/bad/missing token), ingest, alarm, backup, OTA manifest.
 */
import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { Gateway } from '../../../src/models/Gateway';
import { FirmwareRelease } from '../../../src/models/FirmwareRelease';
import { Telemetry } from '../../../src/models/Telemetry';
import { Alarm } from '../../../src/models/Alarm';
import { GatewayBackup } from '../../../src/models/GatewayBackup';

// ── Mock Socket.IO so createApp can be used without a real HTTP server ────────
jest.mock('../../../src/socket/socketServer', () => ({
  emitTelemetry: jest.fn(),
  emitAlarm: jest.fn(),
  emitGatewayStatus: jest.fn(),
  initSocketServer: jest.fn(),
}));

const app = createApp();

const GATEWAY_ID = 'JNX-FG-DEVT';
const DEVICE_TOKEN = 'test-device-token-for-routes';
const SITE_ID = 'SITE001';

const telemetryBody = {
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
    sensor1: { value: 4.2, online: true },
  },
};

const alarmBody = {
  alarmId: 'ALM-HTTP-ROUTE-001',
  siteId: SITE_ID,
  gatewayId: GATEWAY_ID,
  deviceId: 'sensor1',
  parameter: 'pressure_low',
  value: 1.5,
  severity: 'warning',
  timestamp: Math.floor(Date.now() / 1000),
  active: true,
};

const backupBody = {
  gatewayId: GATEWAY_ID,
  fwVersion: '1.0.0',
  ts: Math.floor(Date.now() / 1000),
  config: { thresholds: {} },
  alarmState: { active: [] },
  undelivered: [],
  health: { heap: 200000, uptime: 3600 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function deviceHeaders(id = GATEWAY_ID, token = DEVICE_TOKEN) {
  return { 'X-Gateway-Id': id, 'X-Gateway-Token': token };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearCollections(); });

beforeEach(async () => {
  await Gateway.create({
    gatewayId: GATEWAY_ID,
    siteId: SITE_ID,
    name: 'Test GW',
    fw: '1.0.0',
    hw: 'vvm401',
    online: true,
    deviceToken: DEVICE_TOKEN,
  });
});

// ── Device auth tests ─────────────────────────────────────────────────────────

describe('deviceAuth middleware', () => {
  it('returns 401 when no headers provided', async () => {
    const res = await request(app).post('/api/fireguard/ingest').send(telemetryBody);
    expect(res.status).toBe(401);
  });

  it('returns 401 when X-Gateway-Token is wrong', async () => {
    const res = await request(app)
      .post('/api/fireguard/ingest')
      .set({ 'X-Gateway-Id': GATEWAY_ID, 'X-Gateway-Token': 'wrong-token' })
      .send(telemetryBody);
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown gateway id', async () => {
    const res = await request(app)
      .post('/api/fireguard/ingest')
      .set({ 'X-Gateway-Id': 'UNKNOWN-GW', 'X-Gateway-Token': DEVICE_TOKEN })
      .send(telemetryBody);
    expect(res.status).toBe(401);
  });

  it('passes through with correct credentials', async () => {
    const res = await request(app)
      .post('/api/fireguard/ingest')
      .set(deviceHeaders())
      .send(telemetryBody);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── POST /api/fireguard/ingest ────────────────────────────────────────────────

describe('POST /api/fireguard/ingest', () => {
  it('stores a telemetry doc with source=http', async () => {
    const res = await request(app)
      .post('/api/fireguard/ingest')
      .set(deviceHeaders())
      .send(telemetryBody);
    expect(res.status).toBe(200);
    const docs = await Telemetry.find({ gatewayId: GATEWAY_ID });
    expect(docs.length).toBe(1);
    expect(docs[0]?.source).toBe('http');
  });

  it('returns 200 ok:true on success', async () => {
    const res = await request(app)
      .post('/api/fireguard/ingest')
      .set(deviceHeaders())
      .send(telemetryBody);
    expect(res.body).toEqual({ ok: true });
  });
});

// ── POST /api/fireguard/alarm ─────────────────────────────────────────────────

describe('POST /api/fireguard/alarm', () => {
  it('stores an alarm doc with source=http', async () => {
    const res = await request(app)
      .post('/api/fireguard/alarm')
      .set(deviceHeaders())
      .send(alarmBody);
    expect(res.status).toBe(200);
    const doc = await Alarm.findOne({ alarmId: alarmBody.alarmId });
    expect(doc).toBeTruthy();
    expect(doc?.source).toBe('http');
  });
});

// ── POST /api/fireguard/backup ────────────────────────────────────────────────

describe('POST /api/fireguard/backup', () => {
  it('returns backupId and persists backup', async () => {
    const res = await request(app)
      .post('/api/fireguard/backup')
      .set(deviceHeaders())
      .send(backupBody);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.backupId).toBe('string');
    expect(res.body.backupId.length).toBeGreaterThan(0);

    const stored = await GatewayBackup.findOne({ backupId: res.body.backupId });
    expect(stored).toBeTruthy();
    expect(stored?.gatewayId).toBe(GATEWAY_ID);
    expect(stored?.fwVersion).toBe('1.0.0');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/fireguard/backup')
      .set(deviceHeaders())
      .send({ gatewayId: GATEWAY_ID }); // missing fwVersion, ts, etc.
    expect(res.status).toBe(400);
  });
});

// ── GET /api/fireguard/ota/manifest ──────────────────────────────────────────

describe('GET /api/fireguard/ota/manifest', () => {
  const GW_PARAMS = { gw: GATEWAY_ID, fw: '0.9.0', hw: 'vvm401' };

  beforeEach(async () => {
    await FirmwareRelease.create({
      hw: 'vvm401',
      version: '1.0.0',
      url: 'http://localhost:3001/api/fireguard/ota/binary/vvm401/1.0.0',
      sha256: 'a'.repeat(64),
      size: 1048576,
      mandatory: false,
      releasedAt: new Date(),
      active: true,
    });
  });

  it('returns 200 with manifest when update is available', async () => {
    const res = await request(app)
      .get('/api/fireguard/ota/manifest')
      .set(deviceHeaders())
      .query(GW_PARAMS);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.sha256).toHaveLength(64);
    expect(typeof res.body.url).toBe('string');
    expect(typeof res.body.size).toBe('number');
    expect(typeof res.body.mandatory).toBe('boolean');
  });

  it('returns 204 when device fw is already up to date', async () => {
    const res = await request(app)
      .get('/api/fireguard/ota/manifest')
      .set(deviceHeaders())
      .query({ ...GW_PARAMS, fw: '1.0.0' });
    expect(res.status).toBe(204);
  });

  it('returns 204 when device fw is newer than latest release', async () => {
    const res = await request(app)
      .get('/api/fireguard/ota/manifest')
      .set(deviceHeaders())
      .query({ ...GW_PARAMS, fw: '2.0.0' });
    expect(res.status).toBe(204);
  });

  it('returns 204 when no release exists', async () => {
    await FirmwareRelease.deleteMany({});
    const res = await request(app)
      .get('/api/fireguard/ota/manifest')
      .set(deviceHeaders())
      .query(GW_PARAMS);
    expect(res.status).toBe(204);
  });

  it('returns 400 for invalid fw semver', async () => {
    const res = await request(app)
      .get('/api/fireguard/ota/manifest')
      .set(deviceHeaders())
      .query({ ...GW_PARAMS, fw: 'not-semver' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without device auth', async () => {
    const res = await request(app)
      .get('/api/fireguard/ota/manifest')
      .query(GW_PARAMS);
    expect(res.status).toBe(401);
  });
});
