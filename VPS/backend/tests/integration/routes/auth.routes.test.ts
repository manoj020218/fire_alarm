/**
 * Integration tests — /api/auth routes.
 * Covers: login happy path, bad credentials, refresh, logout, me, rate-limit bypass in test.
 */
import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { User } from '../../../src/models/User';
import { AuditLog } from '../../../src/models/AuditLog';
import { hashPassword } from '../../../src/services/auth.service';
import { USERS_RAW } from '../../shared/fixtures/abcTowers';

const app = createApp();

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearCollections(); });

async function seedSuperAdmin() {
  const raw = USERS_RAW.find((u) => u.role === 'JENIX_SUPER_ADMIN')!;
  const passwordHash = await hashPassword(raw.password);
  return User.create({ ...raw, passwordHash });
}

// ─── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns accessToken + refreshToken on valid credentials', async () => {
    await seedSuperAdmin();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@jenix.io', password: 'Pass@123' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.user.role).toBe('JENIX_SUPER_ADMIN');
  });

  it('returns 401 for wrong password', async () => {
    await seedSuperAdmin();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@jenix.io', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Pass@123' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Pass@123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 for inactive user', async () => {
    const raw = USERS_RAW.find((u) => u.role === 'VIEWER')!;
    const passwordHash = await hashPassword(raw.password);
    await User.create({ ...raw, passwordHash, active: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: raw.email, password: raw.password });
    expect(res.status).toBe(401);
  });

  it('writes an audit log entry on successful login', async () => {
    await seedSuperAdmin();
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@jenix.io', password: 'Pass@123' });

    const auditCount = await AuditLog.countDocuments({ action: 'LOGIN' });
    expect(auditCount).toBe(1);
  });
});

// ─── Refresh ──────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('returns a new accessToken given a valid refresh token', async () => {
    await seedSuperAdmin();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@jenix.io', password: 'Pass@123' });
    const { refreshToken } = loginRes.body as { refreshToken: string };

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('returns 401 for invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'garbage.token.here' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when refreshToken is missing', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 200 and writes LOGOUT audit when authenticated', async () => {
    await seedSuperAdmin();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@jenix.io', password: 'Pass@123' });
    const { accessToken } = loginRes.body as { accessToken: string };

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const logoutAudit = await AuditLog.countDocuments({ action: 'LOGOUT' });
    expect(logoutAudit).toBe(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ─── Me ───────────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns current user profile', async () => {
    await seedSuperAdmin();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@jenix.io', password: 'Pass@123' });
    const { accessToken } = loginRes.body as { accessToken: string };

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin@jenix.io');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
