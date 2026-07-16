/**
 * Integration tests — /api/telemetry routes.
 */
import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { User } from '../../../src/models/User';
import { Site } from '../../../src/models/Site';
import { Gateway } from '../../../src/models/Gateway';
import { Telemetry } from '../../../src/models/Telemetry';
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

const BASE_TELEMETRY = {
  gatewayId: 'JNX-FG-AB12',
  siteId: 'SITE001',
  pid: 'FIREGUARD-S3-01',
  deviceTs: 1720080000,
  timestamp: new Date('2026-07-10T10:00:00Z'),
  system: {
    uptime: 3600,
    heap: 120000,
    fw: '1.0.0',
    releaseDate: '2026-07-01',
    uplink: 'wifi' as const,
    rssi: -65,
    mqtt: 'connected' as const,
    cloud: 'online' as const,
    rs485: 'ok' as const,
    wifi: 'online' as const,
  },
  devices: {
    sprinklerPressure: { value: 4.5, online: true },
  },
  source: 'mqtt' as const,
};

describe('GET /api/telemetry/:gatewayId/latest', () => {
  it('returns the most recent telemetry record', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);
    await Telemetry.create(BASE_TELEMETRY);

    const res = await request(app)
      .get('/api/telemetry/JNX-FG-AB12/latest')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.telemetry.gatewayId).toBe('JNX-FG-AB12');
    expect(res.body.telemetry.system.fw).toBe('1.0.0');
  });

  it('returns 404 when no telemetry exists', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .get('/api/telemetry/JNX-FG-AB12/latest')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/telemetry/JNX-FG-AB12/latest');
    expect(res.status).toBe(401);
  });

  it('returns 403 for user from different site', async () => {
    const raw = USERS_RAW.find((u) => u.role === 'VIEWER')!;
    const passwordHash = await hashPassword(raw.password);
    const viewer = await User.create({ ...raw, passwordHash, siteIds: ['OTHER'] });
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);
    await Telemetry.create(BASE_TELEMETRY);

    const res = await request(app)
      .get('/api/telemetry/JNX-FG-AB12/latest')
      .set('Authorization', `Bearer ${tokenFor(viewer)}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/telemetry/:gatewayId/range', () => {
  it('returns telemetry within the range', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    // Insert 5 records over 5 hours
    for (let i = 0; i < 5; i++) {
      await Telemetry.create({
        ...BASE_TELEMETRY,
        deviceTs: 1720080000 + i * 3600,
        timestamp: new Date(`2026-07-10T${10 + i}:00:00Z`),
      });
    }

    const res = await request(app)
      .get('/api/telemetry/JNX-FG-AB12/range')
      .query({ from: '2026-07-10T09:00:00Z', to: '2026-07-10T16:00:00Z', limit: '100' })
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(5);
  });

  it('returns 400 when from >= to', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .get('/api/telemetry/JNX-FG-AB12/range')
      .query({ from: '2026-07-10T12:00:00Z', to: '2026-07-10T10:00:00Z', limit: '100' })
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 when from/to are missing', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .get('/api/telemetry/JNX-FG-AB12/range')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(400);
  });
});
