/**
 * Integration tests — /api/gateways/:gatewayId/devices routes.
 */
import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { User } from '../../../src/models/User';
import { Site } from '../../../src/models/Site';
import { Gateway } from '../../../src/models/Gateway';
import { AuditLog } from '../../../src/models/AuditLog';
import { hashPassword, signAccessToken } from '../../../src/services/auth.service';
import { USERS_RAW, SITE_ABC, GATEWAY_ABC } from '../../shared/fixtures/abcTowers';
import type { IUserDocument } from '../../../src/models/User';

const app = createApp();

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearCollections(); });

async function seedUser(role: string) {
  const raw = USERS_RAW.find((u) => u.role === role)!;
  const passwordHash = await hashPassword(raw.password);
  return User.create({ ...raw, passwordHash });
}

function tokenFor(user: IUserDocument): string {
  return signAccessToken({
    sub: String(user._id),
    email: user.email,
    role: user.role,
    siteIds: user.siteIds,
  });
}

const DEVICE_PAYLOAD = {
  deviceId: 'sprinklerPressure',
  type: 'pressure_sensor',
  label: 'Sprinkler Pressure',
  unit: 'bar',
  modbus: { slaveId: 1, fc: 3, regAddr: 100, scale: 0.1, unit: 'bar' },
};

describe('GET /api/gateways/:gatewayId/devices', () => {
  it('returns empty list when no devices registered', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .get('/api/gateways/JNX-FG-AB12/devices')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.devices).toEqual([]);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/gateways/JNX-FG-AB12/devices');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/gateways/:gatewayId/devices', () => {
  it('CLIENT_ADMIN can create a device', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .post('/api/gateways/JNX-FG-AB12/devices')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send(DEVICE_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.device.deviceId).toBe('sprinklerPressure');

    const audit = await AuditLog.countDocuments({ action: 'CREATE', entity: 'Device' });
    expect(audit).toBe(1);
  });

  it('VIEWER gets 403 on create', async () => {
    const user = await seedUser('VIEWER');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .post('/api/gateways/JNX-FG-AB12/devices')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send(DEVICE_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid device type', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .post('/api/gateways/JNX-FG-AB12/devices')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ ...DEVICE_PAYLOAD, type: 'invalid_type' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/gateways/:gatewayId/devices/:deviceId', () => {
  it('CLIENT_ADMIN can update a device', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);
    await request(app)
      .post('/api/gateways/JNX-FG-AB12/devices')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send(DEVICE_PAYLOAD);

    const res = await request(app)
      .put('/api/gateways/JNX-FG-AB12/devices/sprinklerPressure')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ label: 'Updated Label' });

    expect(res.status).toBe(200);
    expect(res.body.device.label).toBe('Updated Label');
  });
});

describe('DELETE /api/gateways/:gatewayId/devices/:deviceId', () => {
  it('CLIENT_ADMIN can soft-delete a device', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);
    await request(app)
      .post('/api/gateways/JNX-FG-AB12/devices')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send(DEVICE_PAYLOAD);

    const res = await request(app)
      .delete('/api/gateways/JNX-FG-AB12/devices/sprinklerPressure')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);

    // Verify it no longer appears in the list (active=false)
    const listRes = await request(app)
      .get('/api/gateways/JNX-FG-AB12/devices')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(listRes.body.devices).toHaveLength(0);
  });
});
