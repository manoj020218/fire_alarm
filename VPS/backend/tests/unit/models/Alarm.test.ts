/**
 * Unit tests for Alarm model — required fields, enum validation.
 */
import mongoose from 'mongoose';
import { Alarm } from '../../../src/models/Alarm';
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { ALARM_LOW_PRESSURE } from '../../shared/fixtures/abcTowers';

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearCollections(); });

describe('Alarm model', () => {
  it('saves a valid alarm', async () => {
    const alarm = await Alarm.create(ALARM_LOW_PRESSURE);
    expect(alarm.alarmId).toBe('ALM-TEST-001');
    expect(alarm.acknowledged).toBe(false);
    expect(alarm.active).toBe(true);
  });

  it('enforces alarmId uniqueness', async () => {
    await Alarm.create(ALARM_LOW_PRESSURE);
    await expect(Alarm.create(ALARM_LOW_PRESSURE)).rejects.toThrow();
  });

  it('rejects missing alarmId', async () => {
    const { alarmId: _a, ...noId } = ALARM_LOW_PRESSURE;
    await expect(Alarm.create(noId)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects invalid severity', async () => {
    await expect(
      Alarm.create({ ...ALARM_LOW_PRESSURE, alarmId: 'ALM-002', severity: 'severe' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('accepts warning and critical severity', async () => {
    await Alarm.create({ ...ALARM_LOW_PRESSURE, alarmId: 'ALM-002', severity: 'warning' });
    await Alarm.create({ ...ALARM_LOW_PRESSURE, alarmId: 'ALM-003', severity: 'critical' });
    const count = await Alarm.countDocuments();
    expect(count).toBe(2);
  });

  it('acknowledgeReason stored when set', async () => {
    const alarm = await Alarm.create({
      ...ALARM_LOW_PRESSURE,
      alarmId: 'ALM-ACK-001',
      acknowledged: true,
      acknowledgedBy: 'maint@abctowers.com',
      acknowledgedAt: new Date(),
      acknowledgeReason: 'Pressure restored after valve adjustment',
    });
    expect(alarm.acknowledgeReason).toBe('Pressure restored after valve adjustment');
  });

  it('rejects missing siteId', async () => {
    const { siteId: _s, ...noSite } = ALARM_LOW_PRESSURE;
    await expect(Alarm.create({ ...noSite, alarmId: 'ALM-NS-001' }))
      .rejects.toThrow(mongoose.Error.ValidationError);
  });
});
