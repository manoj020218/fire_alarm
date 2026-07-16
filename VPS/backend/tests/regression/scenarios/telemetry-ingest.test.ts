/**
 * Regression scenario: telemetry ingest → gateway marked online.
 * Sends telemetry via MQTT handler, verifies DB state + gateway.online=true.
 */
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { Gateway } from '../../../src/models/Gateway';
import { Telemetry } from '../../../src/models/Telemetry';
import { handleTelemetry } from '../../../src/mqtt/mqttHandlers';

jest.mock('../../../src/socket/socketServer', () => ({
  emitTelemetry: jest.fn(),
  emitAlarm: jest.fn(),
  emitGatewayStatus: jest.fn(),
}));

const GW_ID = 'JNX-FG-REG01';
const SITE_ID = 'SITE001';

const payload = {
  pid: 'FIREGUARD-S3-01',
  gatewayId: GW_ID,
  siteId: SITE_ID,
  timestamp: Math.floor(Date.now() / 1000),
  system: {
    uptime: 100,
    heap: 150000,
    fw: '1.0.0',
    releaseDate: '2026-07-01',
    uplink: 'wifi',
    rssi: -70,
    mqtt: 'connected',
    cloud: 'online',
    rs485: 'ok',
    wifi: 'online',
  },
  devices: { pump1: { value: 3.5, online: true } },
};

beforeAll(async () => {
  await connectTestDB();
  await Gateway.create({
    gatewayId: GW_ID,
    siteId: SITE_ID,
    name: 'Regression GW',
    fw: '0.9.0',
    hw: 'vvm401',
    online: false,
    deviceToken: 'reg-token-01',
  });
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await Telemetry.deleteMany({}); });

describe('Scenario: Telemetry ingest → Gateway online', () => {
  it('creates Telemetry doc and marks gateway online', async () => {
    await handleTelemetry(Buffer.from(JSON.stringify(payload)));

    const telemetryDoc = await Telemetry.findOne({ gatewayId: GW_ID });
    expect(telemetryDoc).not.toBeNull();
    expect(telemetryDoc?.siteId).toBe(SITE_ID);
    expect(telemetryDoc?.system.fw).toBe('1.0.0');

    const gw = await Gateway.findOne({ gatewayId: GW_ID });
    expect(gw?.online).toBe(true);
    expect(gw?.lastSeenAt).toBeDefined();
  });

  it('multiple telemetry ingest creates multiple docs (no dedup)', async () => {
    await handleTelemetry(Buffer.from(JSON.stringify(payload)));
    await handleTelemetry(Buffer.from(JSON.stringify({ ...payload, timestamp: payload.timestamp + 10 })));

    const count = await Telemetry.countDocuments({ gatewayId: GW_ID });
    expect(count).toBe(2);
  });
});
