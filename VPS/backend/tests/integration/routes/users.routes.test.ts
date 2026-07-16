/**
 * Integration tests — /api/users routes.
 */
import request from 'supertest';
import { createApp } from '../../../src/app';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { User } from '../../../src/models/User';
import { AuditLog } from '../../../src/models/AuditLog';
import { hashPassword, signAccessToken } from '../../../src/services/auth.service';
import { USERS_RAW } from '../../shared/fixtures/abcTowers';
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

describe('GET /api/users', () => {
  it('CLIENT_ADMIN can list users', async () => {
    const admin = await seedUser('CLIENT_ADMIN');
    await seedUser('VIEWER');

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
  });

  it('VIEWER gets 403 (below CLIENT_ADMIN)', async () => {
    const viewer = await seedUser('VIEWER');
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(viewer)}`);
    expect(res.status).toBe(403);
  });

  it('MAINTENANCE_USER gets 403', async () => {
    const maint = await seedUser('MAINTENANCE_USER');
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(maint)}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/users', () => {
  it('SUPER_ADMIN can create a VIEWER', async () => {
    const admin = await seedUser('JENIX_SUPER_ADMIN');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({
        email: 'newviewer@abctowers.com',
        password: 'Pass@1234',
        name: 'New Viewer',
        role: 'VIEWER',
        siteIds: ['SITE001'],
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('VIEWER');
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const audit = await AuditLog.countDocuments({ action: 'CREATE', entity: 'User' });
    expect(audit).toBe(1);
  });

  it('CLIENT_ADMIN cannot create a VENDOR_ADMIN (higher role)', async () => {
    const admin = await seedUser('CLIENT_ADMIN');

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({
        email: 'elevated@jenix.io',
        password: 'Pass@1234',
        name: 'Elevated',
        role: 'VENDOR_ADMIN',
        siteIds: ['SITE001'],
      });

    expect(res.status).toBe(403);
  });

  it('returns 400 for short password', async () => {
    const admin = await seedUser('JENIX_SUPER_ADMIN');
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({
        email: 'short@test.com',
        password: 'abc',
        name: 'Short',
        role: 'VIEWER',
      });
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate email', async () => {
    const admin = await seedUser('JENIX_SUPER_ADMIN');
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ email: 'dup@test.com', password: 'Pass@1234', name: 'Dup', role: 'VIEWER' });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ email: 'dup@test.com', password: 'Pass@1234', name: 'Dup2', role: 'VIEWER' });

    expect(res.status).toBe(409);
  });
});

describe('PUT /api/users/:id', () => {
  it('CLIENT_ADMIN can update a user name', async () => {
    const admin = await seedUser('CLIENT_ADMIN');
    const viewer = await seedUser('VIEWER');

    const res = await request(app)
      .put(`/api/users/${String(viewer._id)}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Updated Name');
  });

  it('CLIENT_ADMIN cannot elevate a user above their own role', async () => {
    const admin = await seedUser('CLIENT_ADMIN');
    const viewer = await seedUser('VIEWER');

    const res = await request(app)
      .put(`/api/users/${String(viewer._id)}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ role: 'JENIX_SUPER_ADMIN' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/users/:id', () => {
  it('SUPER_ADMIN can deactivate a user', async () => {
    const admin = await seedUser('JENIX_SUPER_ADMIN');
    const viewer = await seedUser('VIEWER');

    const res = await request(app)
      .delete(`/api/users/${String(viewer._id)}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    const updated = await User.findById(viewer._id);
    expect(updated?.active).toBe(false);
  });

  it('user cannot delete themselves', async () => {
    const admin = await seedUser('JENIX_SUPER_ADMIN');
    const res = await request(app)
      .delete(`/api/users/${String(admin._id)}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(400);
  });
});
