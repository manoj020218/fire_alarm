/**
 * Regression scenario: alarm ingest → stored + idempotent on resend.
 */
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { Gateway } from '../../../src/models/Gateway';
import { Alarm } from '../../../src/models/Alarm';
import { handleAlarm } from '../../../src/mqtt/mqttHandlers';

jest.mock('../../../src/socket/socketServer', () => ({
  emitTelemetry: jest.fn(),
  emitAlarm: jest.fn(),
  emitGatewayStatus: jest.fn(),
}));

const GW_ID = 'JNX-FG-REG02';
const SITE_ID = 'SITE001';

const alarmPayload = {
  alarmId: 'ALM-REG-SCENARIO-001',
  siteId: SITE_ID,
  gatewayId: GW_ID,
  deviceId: 'sprinklerPressure',
  parameter: 'pressure_low',
  value: 1.2,
  severity: 'warning' as const,
  timestamp: Math.floor(Date.now() / 1000),
  active: true,
};

beforeAll(async () => {
  await connectTestDB();
  await Gateway.create({
    gatewayId: GW_ID,
    siteId: SITE_ID,
    name: 'Alarm Test GW',
    fw: '1.0.0',
    hw: 'vvm401',
    online: true,
    deviceToken: 'reg-token-02',
  });
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearCollections(); });

describe('Scenario: Alarm ingest → stored + idempotent resend', () => {
  it('stores alarm on first receipt', async () => {
    await handleAlarm(Buffer.from(JSON.stringify(alarmPayload)));

    const alarm = await Alarm.findOne({ alarmId: alarmPayload.alarmId });
    expect(alarm).not.toBeNull();
    expect(alarm?.severity).toBe('warning');
    expect(alarm?.active).toBe(true);
    expect(alarm?.source).toBe('mqtt');
    expect(alarm?.acknowledged).toBe(false);
  });

  it('resending same alarmId does not create duplicate', async () => {
    await handleAlarm(Buffer.from(JSON.stringify(alarmPayload)));
    await handleAlarm(Buffer.from(JSON.stringify(alarmPayload)));
    await handleAlarm(Buffer.from(JSON.stringify(alarmPayload)));

    const count = await Alarm.countDocuments({ alarmId: alarmPayload.alarmId });
    expect(count).toBe(1);
  });

  it('resend with active=false marks alarm resolved', async () => {
    await handleAlarm(Buffer.from(JSON.stringify(alarmPayload)));
    const resolved = { ...alarmPayload, active: false };
    await handleAlarm(Buffer.from(JSON.stringify(resolved)));

    const alarm = await Alarm.findOne({ alarmId: alarmPayload.alarmId });
    expect(alarm?.active).toBe(false);
    const total = await Alarm.countDocuments({ alarmId: alarmPayload.alarmId });
    expect(total).toBe(1);
  });
});
