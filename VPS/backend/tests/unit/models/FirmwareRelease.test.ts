/**
 * Unit tests for FirmwareRelease model — semver format, sha256 format, unique hw+version.
 */
import mongoose from 'mongoose';
import { FirmwareRelease } from '../../../src/models/FirmwareRelease';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearCollections(); });

const valid = {
  hw: 'vvm401',
  version: '1.2.0',
  url: 'http://154.61.69.200:3001/firmware/vvm401/1.2.0/fireguard.bin',
  sha256: 'a'.repeat(64),
  size: 524288,
  mandatory: false,
  releasedAt: new Date('2026-07-01'),
  active: true,
};

describe('FirmwareRelease model', () => {
  it('saves a valid release', async () => {
    const rel = await FirmwareRelease.create(valid);
    expect(rel.version).toBe('1.2.0');
    expect(rel.hw).toBe('vvm401');
  });

  it('enforces unique hw + version', async () => {
    await FirmwareRelease.create(valid);
    await expect(FirmwareRelease.create(valid)).rejects.toThrow();
  });

  it('rejects non-semver version', async () => {
    await expect(
      FirmwareRelease.create({ ...valid, version: '1.2' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects malformed sha256', async () => {
    await expect(
      FirmwareRelease.create({ ...valid, sha256: 'shortsha' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects size <= 0', async () => {
    await expect(
      FirmwareRelease.create({ ...valid, size: 0 })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('allows minFrom to be set', async () => {
    const rel = await FirmwareRelease.create({ ...valid, minFrom: '1.0.0' });
    expect(rel.minFrom).toBe('1.0.0');
  });
});
