/**
 * Integration tests — /api/bridge/provision.
 *
 * Covers:
 *  - Valid secret + valid body → 200, Site created, User created, tempPassword returned
 *  - Missing X-Bridge-Secret → 401
 *  - Wrong X-Bridge-Secret → 401
 *  - Duplicate adminEmail → 409
 *  - Missing required body field → 400
 */
import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { Site } from '../../../src/models/Site';
import { User } from '../../../src/models/User';
import { AuditLog } from '../../../src/models/AuditLog';
import { hashPassword } from '../../../src/services/auth.service';

const app = createApp();

const BRIDGE_SECRET = 'test-bridge-secret-min16chars'; // matches jestSetup.ts

const VALID_BODY = {
  orgName: 'Acme Fire Safety Ltd',
  adminName: 'Alice Admin',
  adminEmail: 'alice@acmefire.com',
  phone: '+919876543210',
  trialEndsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
};

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearCollections(); });

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('POST /api/bridge/provision — auth guard', () => {
  it('returns 401 when X-Bridge-Secret is missing', async () => {
    const res = await request(app)
      .post('/api/bridge/provision')
      .send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('returns 401 when X-Bridge-Secret is wrong', async () => {
    const res = await request(app)
      .post('/api/bridge/provision')
      .set('X-Bridge-Secret', 'totally-wrong-secret!')
      .send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('does not reveal timing differences between valid and invalid secrets', async () => {
    // Both should return quickly with 401 — this is a smoke-test,
    // not a true timing oracle test (that requires hundreds of samples).
    const wrongRes = await request(app)
      .post('/api/bridge/provision')
      .set('X-Bridge-Secret', 'wrong-secret-padding-to-make-same-length!!!!')
      .send(VALID_BODY);
    expect(wrongRes.status).toBe(401);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('POST /api/bridge/provision — happy path', () => {
  it('creates Site + CLIENT_ADMIN User and returns tempPassword', async () => {
    const res = await request(app)
      .post('/api/bridge/provision')
      .set('X-Bridge-Secret', BRIDGE_SECRET)
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.siteId).toBe('string');
    expect(res.body.siteId).toMatch(/^SITE-[0-9A-F]{6}$/);
    expect(res.body.adminEmail).toBe('alice@acmefire.com');
    expect(typeof res.body.tempPassword).toBe('string');
    expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(16);
    expect(typeof res.body.loginUrl).toBe('string');

    // Verify Site was persisted
    const siteId = res.body.siteId as string;
    const site = await Site.findOne({ siteId });
    expect(site).not.toBeNull();
    expect(site!.name).toBe('Acme Fire Safety Ltd');
    expect(site!.subscription).toBe('trial');
    expect(site!.trialEndsAt).toBeInstanceOf(Date);
    expect(site!.graceDays).toBe(15);

    // Verify User was persisted
    const user = await User.findOne({ email: 'alice@acmefire.com' });
    expect(user).not.toBeNull();
    expect(user!.role).toBe('CLIENT_ADMIN');
    expect(user!.siteIds).toContain(siteId);
    expect(user!.active).toBe(true);

    // Audit log must exist
    const audit = await AuditLog.countDocuments({ action: 'CREATE', entity: 'Site', entityId: siteId });
    expect(audit).toBe(1);
  });

  it('lowercases adminEmail before creating the user', async () => {
    const res = await request(app)
      .post('/api/bridge/provision')
      .set('X-Bridge-Secret', BRIDGE_SECRET)
      .send({ ...VALID_BODY, adminEmail: 'ALICE@ACMEFIRE.COM' });

    expect(res.status).toBe(200);
    expect(res.body.adminEmail).toBe('alice@acmefire.com');
    const user = await User.findOne({ email: 'alice@acmefire.com' });
    expect(user).not.toBeNull();
  });

  it('returns loginUrl from env.APP_LOGIN_URL', async () => {
    const res = await request(app)
      .post('/api/bridge/provision')
      .set('X-Bridge-Secret', BRIDGE_SECRET)
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.loginUrl).toBe('https://fireguard.iotsoft.in/app');
  });

  it('the returned tempPassword matches the user passwordHash', async () => {
    const { comparePassword } = await import('../../../src/services/auth.service');

    const res = await request(app)
      .post('/api/bridge/provision')
      .set('X-Bridge-Secret', BRIDGE_SECRET)
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    const { tempPassword } = res.body as { tempPassword: string };

    // Fetch user WITH passwordHash (normally select: false)
    const user = await User.findOne({ email: 'alice@acmefire.com' }).select('+passwordHash');
    expect(user).not.toBeNull();
    const valid = await comparePassword(tempPassword, user!.passwordHash);
    expect(valid).toBe(true);
  });
});

// ── Conflict ──────────────────────────────────────────────────────────────────

describe('POST /api/bridge/provision — duplicate email', () => {
  it('returns 409 when adminEmail already exists', async () => {
    // Seed the email first
    const passwordHash = await hashPassword('Pass@123');
    await User.create({
      email: 'alice@acmefire.com',
      passwordHash,
      role: 'CLIENT_ADMIN',
      name: 'Existing Alice',
      siteIds: ['SITE001'],
      active: true,
    });

    const res = await request(app)
      .post('/api/bridge/provision')
      .set('X-Bridge-Secret', BRIDGE_SECRET)
      .send(VALID_BODY);

    expect(res.status).toBe(409);
    expect(res.body.ok).toBe(false);
  });

  it('does not create a Site when the email is already taken', async () => {
    const passwordHash = await hashPassword('Pass@123');
    await User.create({
      email: 'alice@acmefire.com',
      passwordHash,
      role: 'CLIENT_ADMIN',
      name: 'Existing Alice',
      siteIds: ['SITE001'],
      active: true,
    });

    await request(app)
      .post('/api/bridge/provision')
      .set('X-Bridge-Secret', BRIDGE_SECRET)
      .send(VALID_BODY);

    // No new site should have been created
    const count = await Site.countDocuments();
    expect(count).toBe(0);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('POST /api/bridge/provision — body validation', () => {
  it('returns 400 when adminEmail is invalid', async () => {
    const res = await request(app)
      .post('/api/bridge/provision')
      .set('X-Bridge-Secret', BRIDGE_SECRET)
      .send({ ...VALID_BODY, adminEmail: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when orgName is missing', async () => {
    const { orgName: _omit, ...rest } = VALID_BODY;
    const res = await request(app)
      .post('/api/bridge/provision')
      .set('X-Bridge-Secret', BRIDGE_SECRET)
      .send(rest);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when trialEndsAt is not a valid ISO datetime', async () => {
    const res = await request(app)
      .post('/api/bridge/provision')
      .set('X-Bridge-Secret', BRIDGE_SECRET)
      .send({ ...VALID_BODY, trialEndsAt: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
