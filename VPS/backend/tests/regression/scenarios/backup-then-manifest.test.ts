/**
 * Regression scenario: backup → then OTA manifest check.
 * Device must POST backup before OTA (gating flow).
 * Verifies: backup persists, manifest returns update when available, 204 when current.
 */
import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { Gateway } from '../../../src/models/Gateway';
import { FirmwareRelease } from '../../../src/models/FirmwareRelease';
import { GatewayBackup } from '../../../src/models/GatewayBackup';

jest.mock('../../../src/socket/socketServer', () => ({
  emitTelemetry: jest.fn(),
  emitAlarm: jest.fn(),
  emitGatewayStatus: jest.fn(),
  initSocketServer: jest.fn(),
}));

const app = createApp();
const GW_ID = 'JNX-FG-OTA01';
const DEVICE_TOKEN = 'ota-scenario-token-abc';
const SITE_ID = 'SITE001';

function headers() {
  return { 'X-Gateway-Id': GW_ID, 'X-Gateway-Token': DEVICE_TOKEN };
}

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });

beforeEach(async () => {
  await Gateway.create({
    gatewayId: GW_ID,
    siteId: SITE_ID,
    name: 'OTA Test GW',
    fw: '0.9.0',
    hw: 'vvm401',
    online: true,
    deviceToken: DEVICE_TOKEN,
  });

  await FirmwareRelease.create({
    hw: 'vvm401',
    version: '1.0.0',
    url: 'http://localhost:3001/api/fireguard/ota/binary/vvm401/1.0.0',
    sha256: 'b'.repeat(64),
    size: 512000,
    mandatory: false,
    releasedAt: new Date('2026-07-01'),
    active: true,
  });
});

afterEach(async () => { await clearCollections(); });

describe('Scenario: Backup → OTA manifest flow', () => {
  it('Step 1: device posts backup and receives backupId', async () => {
    const res = await request(app)
      .post('/api/fireguard/backup')
      .set(headers())
      .send({
        gatewayId: GW_ID,
        fwVersion: '0.9.0',
        ts: Math.floor(Date.now() / 1000),
        config: { polling: 10 },
        alarmState: { active: [] },
        undelivered: [],
        health: { heap: 200000 },
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.backupId).toBe('string');

    const stored = await GatewayBackup.findOne({ backupId: res.body.backupId });
    expect(stored).not.toBeNull();
    expect(stored?.fwVersion).toBe('0.9.0');
  });

  it('Step 2: manifest check reveals available update', async () => {
    const res = await request(app)
      .get('/api/fireguard/ota/manifest')
      .set(headers())
      .query({ gw: GW_ID, fw: '0.9.0', hw: 'vvm401' });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.sha256).toHaveLength(64);
  });

  it('Step 3: after update, manifest returns 204', async () => {
    const res = await request(app)
      .get('/api/fireguard/ota/manifest')
      .set(headers())
      .query({ gw: GW_ID, fw: '1.0.0', hw: 'vvm401' });

    expect(res.status).toBe(204);
  });

  it('Full flow: backup → manifest → confirm update', async () => {
    // 1. Backup
    const backupRes = await request(app)
      .post('/api/fireguard/backup')
      .set(headers())
      .send({
        gatewayId: GW_ID,
        fwVersion: '0.9.0',
        ts: Math.floor(Date.now() / 1000),
        config: {},
        alarmState: {},
        undelivered: [],
        health: {},
      });
    expect(backupRes.status).toBe(200);
    const { backupId } = backupRes.body as { backupId: string };

    // 2. Check manifest — expects update
    const manifestRes = await request(app)
      .get('/api/fireguard/ota/manifest')
      .set(headers())
      .query({ gw: GW_ID, fw: '0.9.0', hw: 'vvm401' });
    expect(manifestRes.status).toBe(200);
    expect(manifestRes.body.version).toBe('1.0.0');

    // 3. Confirm backup was durably stored
    const backup = await GatewayBackup.findOne({ backupId });
    expect(backup).not.toBeNull();
  });
});
