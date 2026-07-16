/**
 * Integration tests — /api/sites routes.
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

describe('GET /api/sites', () => {
  it('returns seeded sites for super admin', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);

    const res = await request(app)
      .get('/api/sites')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.sites).toHaveLength(1);
    expect(res.body.sites[0].siteId).toBe('SITE001');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/sites');
    expect(res.status).toBe(401);
  });

  it('VIEWER only sees their own sites', async () => {
    const user = await seedUser('VIEWER');
    await Site.create(SITE_ABC);
    // Second site not in user.siteIds
    await Site.create({ siteId: 'SITE002', name: 'Other Site', address: 'x', timezone: 'UTC', active: true });

    const res = await request(app)
      .get('/api/sites')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    // Viewer siteIds = ['SITE001'], so only SITE001 appears
    const ids = (res.body.sites as Array<{ siteId: string }>).map((s) => s.siteId);
    expect(ids).toContain('SITE001');
    expect(ids).not.toContain('SITE002');
  });
});

describe('POST /api/sites', () => {
  it('VENDOR_ADMIN can create a site', async () => {
    const user = await seedUser('VENDOR_ADMIN');
    const res = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({
        siteId: 'NEWSITE',
        name: 'New Site',
        address: '123 Main St',
        timezone: 'Asia/Kolkata',
      });

    expect(res.status).toBe(201);
    expect(res.body.site.siteId).toBe('NEWSITE');

    const audit = await AuditLog.countDocuments({ action: 'CREATE', entity: 'Site' });
    expect(audit).toBe(1);
  });

  it('VIEWER gets 403 on create', async () => {
    const user = await seedUser('VIEWER');
    const res = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ siteId: 'HACK', name: 'Hack', address: 'x', timezone: 'UTC' });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid siteId format', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    const res = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ siteId: 'invalid site!', name: 'Bad', address: 'x', timezone: 'UTC' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/sites/:siteId', () => {
  it('CLIENT_ADMIN cannot update a site (needs VENDOR_ADMIN)', async () => {
    const user = await seedUser('CLIENT_ADMIN');
    await Site.create(SITE_ABC);

    const res = await request(app)
      .put('/api/sites/SITE001')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(403);
  });

  it('VENDOR_ADMIN can update', async () => {
    const user = await seedUser('VENDOR_ADMIN');
    await Site.create(SITE_ABC);

    const res = await request(app)
      .put('/api/sites/SITE001')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.site.name).toBe('Updated Name');
  });
});

describe('DELETE /api/sites/:siteId', () => {
  it('only JENIX_SUPER_ADMIN can delete', async () => {
    const vendor = await seedUser('VENDOR_ADMIN');
    await Site.create(SITE_ABC);

    const res = await request(app)
      .delete('/api/sites/SITE001')
      .set('Authorization', `Bearer ${tokenFor(vendor)}`);

    expect(res.status).toBe(403);
  });

  it('JENIX_SUPER_ADMIN soft-deletes and writes audit', async () => {
    const user = await seedUser('JENIX_SUPER_ADMIN');
    await Site.create(SITE_ABC);

    const res = await request(app)
      .delete('/api/sites/SITE001')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    const site = await Site.findOne({ siteId: 'SITE001' });
    expect(site?.active).toBe(false);
  });
});
