/**
 * Integration tests — /api/alarms routes.
 */
import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { User } from '../../../src/models/User';
import { Site } from '../../../src/models/Site';
import { Alarm } from '../../../src/models/Alarm';
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

describe('GET /api/alarms', () => {
  it('returns alarms filtered by siteId', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);
    await Alarm.create(ALARM_LOW_PRESSURE);

    const res = await request(app)
      .get('/api/alarms?siteId=SITE001')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.alarms).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('filters by severity', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Alarm.create(ALARM_LOW_PRESSURE);
    await Alarm.create({ ...ALARM_LOW_PRESSURE, alarmId: 'ALM-002', severity: 'critical' });

    const res = await request(app)
      .get('/api/alarms?severity=critical')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.alarms).toHaveLength(1);
    expect(res.body.alarms[0].severity).toBe('critical');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/alarms');
    expect(res.status).toBe(401);
  });

  it('VIEWER from other site does not see alarms', async () => {
    const raw = USERS_RAW.find((u) => u.role === 'VIEWER')!;
    const passwordHash = await hashPassword(raw.password);
    const viewer = await User.create({ ...raw, passwordHash, siteIds: ['OTHER_SITE'] });
    await Alarm.create(ALARM_LOW_PRESSURE);

    const res = await request(app)
      .get('/api/alarms')
      .set('Authorization', `Bearer ${tokenFor(viewer)}`);

    expect(res.status).toBe(200);
    expect(res.body.alarms).toHaveLength(0);
  });

  it('paginates correctly', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    // Create 3 alarms
    for (let i = 0; i < 3; i++) {
      await Alarm.create({ ...ALARM_LOW_PRESSURE, alarmId: `ALM-PAG-${i}` });
    }

    const res = await request(app)
      .get('/api/alarms?page=1&limit=2')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.alarms).toHaveLength(2);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.pages).toBe(2);
  });
});

describe('POST /api/alarms/:id/ack', () => {
  it('MAINTENANCE_USER can acknowledge an alarm', async () => {
    const user = await seedUser('MAINTENANCE_USER');
    const alarm = await Alarm.create(ALARM_LOW_PRESSURE);

    const res = await request(app)
      .post(`/api/alarms/${String(alarm._id)}/ack`)
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ reason: 'Checked — pressure restored' });

    expect(res.status).toBe(200);
    expect(res.body.alarm.acknowledged).toBe(true);
    expect(res.body.alarm.acknowledgeReason).toBe('Checked — pressure restored');

    const audit = await AuditLog.countDocuments({ action: 'ACK_ALARM' });
    expect(audit).toBe(1);
  });

  it('VIEWER cannot acknowledge (403)', async () => {
    const user = await seedUser('VIEWER');
    const alarm = await Alarm.create(ALARM_LOW_PRESSURE);

    const res = await request(app)
      .post(`/api/alarms/${String(alarm._id)}/ack`)
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ reason: 'should not work' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when reason is missing', async () => {
    const user = await seedUser('MAINTENANCE_USER');
    const alarm = await Alarm.create(ALARM_LOW_PRESSURE);

    const res = await request(app)
      .post(`/api/alarms/${String(alarm._id)}/ack`)
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 when alarm already acknowledged', async () => {
    const user = await seedUser('MAINTENANCE_USER');
    const alarm = await Alarm.create({
      ...ALARM_LOW_PRESSURE,
      acknowledged: true,
      acknowledgedBy: 'someone',
      acknowledgedAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/alarms/${String(alarm._id)}/ack`)
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ reason: 'already done' });

    expect(res.status).toBe(409);
  });

  it('user from different site gets 403', async () => {
    const raw = USERS_RAW.find((u) => u.role === 'MAINTENANCE_USER')!;
    const passwordHash = await hashPassword(raw.password);
    const maint = await User.create({ ...raw, passwordHash, siteIds: ['OTHER'] });

    const alarm = await Alarm.create(ALARM_LOW_PRESSURE); // SITE001

    const res = await request(app)
      .post(`/api/alarms/${String(alarm._id)}/ack`)
      .set('Authorization', `Bearer ${tokenFor(maint)}`)
      .send({ reason: 'cross-site attempt' });

    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const alarm = await Alarm.create(ALARM_LOW_PRESSURE);
    const res = await request(app)
      .post(`/api/alarms/${String(alarm._id)}/ack`)
      .send({ reason: 'test' });
    expect(res.status).toBe(401);
  });
});
