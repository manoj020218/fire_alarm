/**
 * Unit tests for usageReporter — verifies payload shape and that fetch is called
 * correctly. Uses jest.spyOn to mock the global fetch so no real network calls.
 */
import { connectTestDB, disconnectTestDB, clearCollections } from '../../shared/db';
import { Site } from '../../../src/models/Site';
import { Device } from '../../../src/models/Device';
import { Gateway } from '../../../src/models/Gateway';
import { reportAllSites } from '../../../src/services/usageReporter';
import { SITE_ABC, GATEWAY_ABC } from '../../shared/fixtures/abcTowers';

// ─── Mock global fetch ────────────────────────────────────────────────────────

type FetchArgs = Parameters<typeof fetch>;

let fetchSpy: jest.SpyInstance<Promise<Response>, FetchArgs>;

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => {
  await clearCollections();
  fetchSpy.mockRestore();
});
beforeEach(() => {
  fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200 })
  );
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('reportAllSites', () => {
  it('does not call fetch when there are no active sites', async () => {
    await reportAllSites();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls fetch with the correct URL, headers, and body for one site', async () => {
    await Site.create({
      ...SITE_ABC,
      subscription: 'trial',
      graceDays: 15,
    });
    // 2 active devices, 1 gateway
    await Gateway.create(GATEWAY_ABC);
    await Device.create({
      deviceId: 'dev1',
      gatewayId: 'JNX-FG-AB12',
      siteId: 'SITE001',
      type: 'pressure_sensor',
      label: 'Sensor 1',
      active: true,
    });
    await Device.create({
      deviceId: 'dev2',
      gatewayId: 'JNX-FG-AB12',
      siteId: 'SITE001',
      type: 'pump',
      label: 'Pump 1',
      active: true,
    });
    // Inactive device — should NOT be counted
    await Device.create({
      deviceId: 'dev3',
      gatewayId: 'JNX-FG-AB12',
      siteId: 'SITE001',
      type: 'valve',
      label: 'Valve (inactive)',
      active: false,
    });

    await reportAllSites();

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as FetchArgs;
    expect(String(url)).toContain('/api/fireguard/usage');
    expect(String(url)).toContain('iotsoft.in');

    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['X-Bridge-Secret']).toBe(
      'test-bridge-secret-min16chars'
    );
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(init?.body as string) as {
      siteId: string;
      deviceCount: number;
      gatewayCount: number;
    };
    expect(body.siteId).toBe('SITE001');
    expect(body.deviceCount).toBe(2); // only active devices
    expect(body.gatewayCount).toBe(1);
  });

  it('reports multiple sites individually', async () => {
    await Site.create({
      ...SITE_ABC,
      subscription: 'trial',
      graceDays: 15,
    });
    await Site.create({
      siteId: 'SITE-BB2233',
      name: 'Second Site',
      address: 'Elsewhere',
      timezone: 'Asia/Kolkata',
      active: true,
      subscription: 'active',
      graceDays: 15,
    });

    await reportAllSites();

    // One fetch call per site
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('skips inactive sites', async () => {
    await Site.create({
      ...SITE_ABC,
      active: false,
      subscription: 'trial',
      graceDays: 15,
    });

    await reportAllSites();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not throw when fetch fails (best-effort)', async () => {
    fetchSpy.mockRejectedValue(new Error('Network timeout'));

    await Site.create({
      ...SITE_ABC,
      subscription: 'trial',
      graceDays: 15,
    });

    // Should not throw
    await expect(reportAllSites()).resolves.toBeUndefined();
  });

  it('continues reporting other sites when one fetch fails', async () => {
    await Site.create({
      ...SITE_ABC,
      subscription: 'trial',
      graceDays: 15,
    });
    await Site.create({
      siteId: 'SITE-CC3344',
      name: 'Third Site',
      address: 'Address 3',
      timezone: 'Asia/Kolkata',
      active: true,
      subscription: 'active',
      graceDays: 15,
    });

    // First call fails, second succeeds
    fetchSpy
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(reportAllSites()).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
