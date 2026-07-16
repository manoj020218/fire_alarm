/**
 * Unit tests for Gateway model.
 */
import mongoose from 'mongoose';
import { Gateway } from '../../../src/models/Gateway';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearCollections(); });

const valid = {
  gatewayId: 'JNX-FG-AB12',
  siteId: 'SITE001',
  name: 'Pump Room Gateway',
  fw: '1.0.0',
  hw: 'vvm401',
  deviceToken: 'secret-token-abc',
};

describe('Gateway model', () => {
  it('saves a valid gateway', async () => {
    const gw = await Gateway.create(valid);
    expect(gw.gatewayId).toBe('JNX-FG-AB12');
    expect(gw.online).toBe(false); // default
  });

  it('enforces gatewayId uniqueness', async () => {
    await Gateway.create(valid);
    await expect(Gateway.create(valid)).rejects.toThrow();
  });

  it('rejects missing gatewayId', async () => {
    const { gatewayId: _g, ...noId } = valid;
    await expect(Gateway.create(noId)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects invalid uplink enum', async () => {
    await expect(
      Gateway.create({ ...valid, gatewayId: 'JNX-FG-X999', uplink: 'bluetooth' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('accepts valid uplink values', async () => {
    for (const [i, uplink] of (['wifi', 'lan', '4g'] as const).entries()) {
      await Gateway.create({ ...valid, gatewayId: `JNX-FG-UPL${i}`, uplink });
    }
    expect(await Gateway.countDocuments()).toBe(3);
  });

  it('deviceToken is not returned by default', async () => {
    await Gateway.create(valid);
    const found = await Gateway.findOne({ gatewayId: valid.gatewayId });
    expect((found as unknown as { deviceToken?: string }).deviceToken).toBeUndefined();
  });
});
