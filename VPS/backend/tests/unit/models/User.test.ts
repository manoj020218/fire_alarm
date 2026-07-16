/**
 * Unit tests for User model — validation, required fields, enums, unique email.
 */
import mongoose from 'mongoose';
import { User, ROLES } from '../../../src/models/User';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearCollections(); });

describe('User model', () => {
  const valid = {
    email: 'test@jenix.io',
    passwordHash: '$2b$12$hashed',
    role: 'CLIENT_ADMIN' as const,
    name: 'Test User',
    siteIds: ['SITE001'],
  };

  it('saves a valid user', async () => {
    const user = await User.create(valid);
    expect(user._id).toBeDefined();
    expect(user.active).toBe(true); // default
    expect(user.siteIds).toEqual(['SITE001']);
  });

  it('lowercases email', async () => {
    const user = await User.create({ ...valid, email: 'UPPER@JENIX.IO' });
    expect(user.email).toBe('upper@jenix.io');
  });

  it('enforces email uniqueness', async () => {
    await User.create(valid);
    await expect(User.create(valid)).rejects.toThrow();
  });

  it('rejects invalid email format', async () => {
    await expect(
      User.create({ ...valid, email: 'notanemail' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects missing email', async () => {
    const { email: _e, ...noEmail } = valid;
    await expect(User.create(noEmail)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects missing name', async () => {
    const { name: _n, ...noName } = valid;
    await expect(User.create(noName)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects invalid role', async () => {
    await expect(
      User.create({ ...valid, role: 'UNKNOWN_ROLE' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('accepts all valid roles', async () => {
    for (const [i, role] of ROLES.entries()) {
      await User.create({ ...valid, email: `role${i}@test.com`, role });
    }
    const count = await User.countDocuments();
    expect(count).toBe(ROLES.length);
  });

  it('does not return passwordHash by default', async () => {
    await User.create(valid);
    const found = await User.findOne({ email: valid.email });
    expect(found).not.toBeNull();
    // passwordHash has select: false
    expect((found as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
  });

  it('returns passwordHash when explicitly selected', async () => {
    await User.create(valid);
    const found = await User.findOne({ email: valid.email }).select('+passwordHash');
    expect(found?.passwordHash).toBeDefined();
  });
});
