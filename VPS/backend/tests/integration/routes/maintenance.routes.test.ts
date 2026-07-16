/**
 * Integration tests — /api/maintenance routes.
 */
import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { User } from '../../../src/models/User';
import { Site } from '../../../src/models/Site';
import { AuditLog } from '../../../src/models/AuditLog';
import { hashPassword, signAccessToken } from '../../../src/services/auth.service';
import { USERS_RAW, SITE_ABC } from '../../shared/fixtures/abcTowers';
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

const LOG_PAYLOAD = {
  siteId: 'SITE001',
  type: 'inspection',
  description: 'Monthly pump room inspection',
  performedAt: '2026-07-10T09:00:00Z',
};

describe('POST /api/maintenance', () => {
  it('MAINTENANCE_USER can create a maintenance log', async () => {
    const user = await seedUser('MAINTENANCE_USER');
    await Site.create(SITE_ABC);

    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send(LOG_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.log.type).toBe('inspection');
    expect(res.body.log.performedBy).toBe(String(user._id));

    const audit = await AuditLog.countDocuments({ action: 'CREATE', entity: 'MaintenanceLog' });
    expect(audit).toBe(1);
  });

  it('VIEWER gets 403', async () => {
    const user = await seedUser('VIEWER');
    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send(LOG_PAYLOAD);
    expect(res.status).toBe(403);
  });

  it('returns 400 when description is missing', async () => {
    const user = await seedUser('MAINTENANCE_USER');
    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ siteId: 'SITE001', type: 'inspection', performedAt: '2026-07-10T09:00:00Z' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/maintenance').send(LOG_PAYLOAD);
    expect(res.status).toBe(401);
  });

  it('user from different site gets 403', async () => {
    const raw = USERS_RAW.find((u) => u.role === 'MAINTENANCE_USER')!;
    const passwordHash = await hashPassword(raw.password);
    const user = await User.create({ ...raw, passwordHash, siteIds: ['OTHER'] });

    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send(LOG_PAYLOAD);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/maintenance', () => {
  it('VIEWER can list maintenance logs', async () => {
    const maint = await seedUser('MAINTENANCE_USER');
    const viewer = await seedUser('VIEWER');
    await Site.create(SITE_ABC);

    await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${tokenFor(maint)}`)
      .send(LOG_PAYLOAD);

    const res = await request(app)
      .get('/api/maintenance')
      .set('Authorization', `Bearer ${tokenFor(viewer)}`);

    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/maintenance');
    expect(res.status).toBe(401);
  });
});
