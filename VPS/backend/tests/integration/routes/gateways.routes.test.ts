/**
 * Integration tests — /api/gateways routes.
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

async function seedAll() {
  const user = await seedUser('JENIX_SUPER_ADMIN');
  await Site.create(SITE_ABC);
  await Gateway.create(GATEWAY_ABC);
  return user;
}

describe('GET /api/gateways', () => {
  it('returns gateways for super admin', async () => {
    const user = await seedAll();
    const res = await request(app)
      .get('/api/gateways')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(200);
    expect(res.body.gateways).toHaveLength(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/gateways');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/gateways/:id', () => {
  it('returns the gateway', async () => {
    const user = await seedAll();
    const res = await request(app)
      .get('/api/gateways/JNX-FG-AB12')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(200);
    expect(res.body.gateway.gatewayId).toBe('JNX-FG-AB12');
  });

  it('returns 404 for unknown gateway', async () => {
    const user = await seedAll();
    const res = await request(app)
      .get('/api/gateways/NOEXIST')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(404);
  });

  it('VIEWER from other site gets 403', async () => {
    const raw = USERS_RAW.find((u) => u.role === 'VIEWER')!;
    const passwordHash = await hashPassword(raw.password);
    const viewer = await User.create({ ...raw, passwordHash, siteIds: ['OTHER'] });
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .get('/api/gateways/JNX-FG-AB12')
      .set('Authorization', `Bearer ${tokenFor(viewer)}`);
    expect(res.status).toBe(403);
  });
});

describe('GET/PUT /api/gateways/:id/config', () => {
  it('GET config returns empty array when no device configs exist', async () => {
    const user = await seedAll();
    const res = await request(app)
      .get('/api/gateways/JNX-FG-AB12/config')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(200);
    expect(res.body.configs).toEqual([]);
  });

  it('PUT config stores desired config and returns configs', async () => {
    const user = await seedAll();
    const res = await request(app)
      .put('/api/gateways/JNX-FG-AB12/config')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({
        thresholds: {
          sprinklerPressure: { low: 2.0, high: 10.0 },
        },
        pollIntervalSec: 30,
      });
    expect(res.status).toBe(200);
    expect(res.body.configs).toHaveLength(1);
    expect(res.body.configs[0].thresholds.low).toBe(2.0);

    const audit = await AuditLog.countDocuments({ action: 'CONFIG_CHANGE', entity: 'Gateway' });
    expect(audit).toBe(1);
  });

  it('VIEWER gets 403 on PUT config', async () => {
    const viewer = await seedUser('VIEWER');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .put('/api/gateways/JNX-FG-AB12/config')
      .set('Authorization', `Bearer ${tokenFor(viewer)}`)
      .send({ thresholds: {} });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/gateways/:id/command', () => {
  it('CLIENT_ADMIN can send a command', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .post('/api/gateways/JNX-FG-AB12/command')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ command: 'reboot' });

    expect(res.status).toBe(200);
    expect(res.body.command.command).toBe('reboot');
  });

  it('VIEWER gets 403 on command', async () => {
    const viewer = await seedUser('VIEWER');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .post('/api/gateways/JNX-FG-AB12/command')
      .set('Authorization', `Bearer ${tokenFor(viewer)}`)
      .send({ command: 'reboot' });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid command', async () => {
    const user = await seedAll();
    const res = await request(app)
      .post('/api/gateways/JNX-FG-AB12/command')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ command: 'explode' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/gateways/:id/token (rotate)', () => {
  it('JENIX_SUPER_ADMIN can rotate device token', async () => {
    const user = await seedAll();
    const res = await request(app)
      .post('/api/gateways/JNX-FG-AB12/token')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.deviceToken).toBe('string');
    expect(res.body.deviceToken).not.toBe('test-device-token-abc12');

    const audit = await AuditLog.countDocuments({ action: 'DEVICE_TOKEN_ROTATE' });
    expect(audit).toBe(1);
  });

  it('CLIENT_ADMIN gets 403 on token rotation', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .post('/api/gateways/JNX-FG-AB12/token')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(403);
  });
});
