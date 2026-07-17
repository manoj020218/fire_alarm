/**
 * Integration tests — /api/subscription + subscriptionGate behaviour.
 *
 * Covers:
 *  - GET /api/subscription returns status + daysLeft for a CLIENT_ADMIN
 *  - Super roles get active/null regardless of site state
 *  - subscriptionGate: expired site blocks device POST (402)
 *  - subscriptionGate: expired site allows device GET
 *  - subscriptionGate: expired site allows alarm ACK (POST /api/alarms/:id/ack)
 *  - subscriptionGate: telemetry ingest (/api/fireguard/*) is NEVER blocked
 *  - subscriptionGate: auth routes (/api/auth/*) are NEVER blocked
 */
import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { User } from '../../../src/models/User';
import { Site } from '../../../src/models/Site';
import { Gateway } from '../../../src/models/Gateway';
import { Alarm } from '../../../src/models/Alarm';
import { hashPassword, signAccessToken } from '../../../src/services/auth.service';
import { USERS_RAW, SITE_ABC, GATEWAY_ABC, ALARM_LOW_PRESSURE } from '../../shared/fixtures/abcTowers';
import type { IUserDocument } from '../../../src/models/User';

const app = createApp();

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearCollections(); });

async function seedUser(role: string): Promise<IUserDocument> {
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

// Helper: create a site that is definitively expired (trial ended 60 days ago, grace 15 days)
async function seedExpiredSite(): Promise<void> {
  const trialEndsAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
  await Site.create({
    ...SITE_ABC,
    subscription: 'trial',
    trialEndsAt,
    graceDays: 15,
  });
}

// Helper: create a site that is within trial window
async function seedActiveTrial(daysLeft = 30): Promise<void> {
  const trialEndsAt = new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000);
  await Site.create({
    ...SITE_ABC,
    subscription: 'trial',
    trialEndsAt,
    graceDays: 15,
  });
}

// ── GET /api/subscription ─────────────────────────────────────────────────────

describe('GET /api/subscription', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/subscription');
    expect(res.status).toBe(401);
  });

  it('returns active trial status + daysLeft for CLIENT_ADMIN within trial', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await seedActiveTrial(30);

    const res = await request(app)
      .get('/api/subscription')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.subscription.status).toBe('trial');
    // daysLeft should be approximately 30
    expect(res.body.subscription.daysLeft).toBeGreaterThan(0);
  });

  it('returns expired status when trial + grace have elapsed', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await seedExpiredSite();

    const res = await request(app)
      .get('/api/subscription')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('expired');
    expect(res.body.subscription.daysLeft).toBe(0);
  });

  it('super admin always gets active with no countdown', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    // No site for super admin needed
    const res = await request(app)
      .get('/api/subscription')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('active');
    expect(res.body.subscription.daysLeft).toBeNull();
  });

  it('returns suspended status for a suspended site', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await Site.create({ ...SITE_ABC, subscription: 'suspended' });

    const res = await request(app)
      .get('/api/subscription')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('suspended');
  });
});

// ── subscriptionGate: expired site ────────────────────────────────────────────

describe('subscriptionGate — expired site', () => {
  it('blocks POST /api/gateways/:gatewayId/devices with 402 SUBSCRIPTION_EXPIRED', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await seedExpiredSite();
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .post('/api/gateways/JNX-FG-AB12/devices')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({
        deviceId: 'testDevice',
        type: 'pressure_sensor',
        label: 'Test Sensor',
      });

    expect(res.status).toBe(402);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('allows GET /api/gateways/:gatewayId/devices (read-only)', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await seedExpiredSite();
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .get('/api/gateways/JNX-FG-AB12/devices')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    // Should be 200 (read through) — not 402
    expect(res.status).toBe(200);
  });

  it('blocks PUT (update) routes with 402', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await seedExpiredSite();

    const res = await request(app)
      .put('/api/sites/SITE001')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ name: 'Attempt update' });

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('allows POST /api/auth/login even when expired', async () => {
    // This test verifies auth is never blocked.
    // We seed the user but do NOT need the site to exist for login.
    const user = await seedUser('CLIENT_ADMIN');
    await seedExpiredSite();

    // We cannot use req.user here (it comes from token, not DB)
    // The point: /api/auth/* is explicitly excluded from the gate.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Pass@123' });

    // Should not get 402
    expect(loginRes.status).not.toBe(402);
    // Will be 200 (credentials valid)
    expect(loginRes.status).toBe(200);
  });

  it('allows GET /api/subscription even when expired (so dashboard banner can show)', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await seedExpiredSite();

    const res = await request(app)
      .get('/api/subscription')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.status).not.toBe(402);
  });

  it('allows alarm ACK POST /api/alarms/:id/ack even when expired (safety)', async () => {
    const user = await seedUser('MAINTENANCE_USER');
    await seedExpiredSite();
    // Create an alarm to ACK
    const alarm = await Alarm.create(ALARM_LOW_PRESSURE);

    const res = await request(app)
      .post(`/api/alarms/${String(alarm._id)}/ack`)
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ note: 'Acknowledged during expired trial' });

    // Must not be 402 — safety requirement
    expect(res.status).not.toBe(402);
    // Expect 200 or 404 depending on ACK logic, but never 402
  });
});

// ── subscriptionGate: active trial ────────────────────────────────────────────

describe('subscriptionGate — active trial (not blocked)', () => {
  it('allows POST /api/gateways/:gatewayId/devices during active trial', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await seedActiveTrial(30);
    await Gateway.create(GATEWAY_ABC);

    const res = await request(app)
      .post('/api/gateways/JNX-FG-AB12/devices')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({
        deviceId: 'sprinklerPressure',
        type: 'pressure_sensor',
        label: 'Sprinkler Pressure',
        modbus: { slaveId: 1, fc: 3, regAddr: 100, scale: 0.1, unit: 'bar' },
      });

    expect(res.status).toBe(201);
  });
});

// ── Telemetry ingest — NEVER blocked ──────────────────────────────────────────

describe('subscriptionGate — /api/fireguard/* never blocked', () => {
  it('telemetry ingest route is accessible without JWT (device auth) — gate never fires', async () => {
    // We send without device auth — should get 401 from deviceAuth, NOT 402 from gate
    const res = await request(app)
      .post('/api/fireguard/ingest')
      .send({ readings: [] });

    // 401 (device auth) NOT 402 (subscription gate)
    expect(res.status).toBe(401);
    expect(res.body.code).not.toBe('SUBSCRIPTION_EXPIRED');
  });
});
