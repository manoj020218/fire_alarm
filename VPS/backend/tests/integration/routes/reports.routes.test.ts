/**
 * Integration tests — /api/reports routes.
 */
import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { User } from '../../../src/models/User';
import { Site } from '../../../src/models/Site';
import { Alarm } from '../../../src/models/Alarm';
import { Report } from '../../../src/models/Report';
import { AuditLog } from '../../../src/models/AuditLog';
import { hashPassword, signAccessToken } from '../../../src/services/auth.service';
import { USERS_RAW, SITE_ABC, ALARM_LOW_PRESSURE } from '../../shared/fixtures/abcTowers';
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

describe('POST /api/reports/generate', () => {
  it('generates a CSV alarm_summary report', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);
    await Alarm.create(ALARM_LOW_PRESSURE);

    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({
        siteId: 'SITE001',
        type: 'alarm_summary',
        format: 'csv',
        rangeFrom: '2026-07-01T00:00:00Z',
        rangeTo: '2026-07-31T23:59:59Z',
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('alarmId');
    expect(res.text).toContain('ALM-TEST-001');

    const report = await Report.findOne({ type: 'alarm_summary' });
    expect(report?.status).toBe('ready');

    const audit = await AuditLog.countDocuments({ action: 'CREATE', entity: 'Report' });
    expect(audit).toBe(1);
  });

  it('returns 501 for PDF format', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);

    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({
        siteId: 'SITE001',
        type: 'daily',
        format: 'pdf',
        rangeFrom: '2026-07-01T00:00:00Z',
        rangeTo: '2026-07-31T23:59:59Z',
      });

    expect(res.status).toBe(501);
  });

  it('returns 400 for invalid format', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({
        siteId: 'SITE001',
        type: 'daily',
        format: 'excel',
        rangeFrom: '2026-07-01T00:00:00Z',
        rangeTo: '2026-07-31T23:59:59Z',
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 when rangeFrom >= rangeTo', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({
        siteId: 'SITE001',
        type: 'daily',
        format: 'csv',
        rangeFrom: '2026-07-31T00:00:00Z',
        rangeTo: '2026-07-01T00:00:00Z',
      });
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/reports/generate').send({
      siteId: 'SITE001', type: 'daily', format: 'csv',
      rangeFrom: '2026-07-01T00:00:00Z', rangeTo: '2026-07-31T00:00:00Z',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/reports', () => {
  it('lists reports for the caller', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);
    await Report.create({
      siteId: 'SITE001',
      type: 'daily',
      format: 'csv',
      status: 'ready',
      requestedBy: String(user._id),
      requestedAt: new Date(),
      rangeFrom: new Date('2026-07-01'),
      rangeTo: new Date('2026-07-31'),
    });

    const res = await request(app)
      .get('/api/reports')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.reports).toHaveLength(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(401);
  });
});
