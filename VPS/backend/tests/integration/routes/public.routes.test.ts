/**
 * Integration tests — POST /api/public/signup proxy.
 *
 * Uses jest.spyOn to mock globalThis.fetch so no network calls are made.
 * Covers:
 *  - Valid body → 200, forwards billing JSON
 *  - Billing 409 → 409 with {ok:false,error:'An account already exists...'}
 *  - Network error (fetch throws) → 502
 *  - Missing required field → 400 (Zod validation)
 */
import request from 'supertest';
import { createApp } from '../../../src/app';

const app = createApp();

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as globalThis.Response);
}

function mockFetchNetworkError(): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network timeout'));
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

const VALID_BODY = {
  companyName: 'ABC Fire Safety Ltd',
  contactName: 'Ravi Kumar',
  phone: '+919876543210',
  email: 'ravi@abcfire.com',
};

describe('POST /api/public/signup — validation', () => {
  it('returns 400 when companyName is missing', async () => {
    const res = await request(app)
      .post('/api/public/signup')
      .send({ contactName: 'Test', phone: '+919999999999', email: 'a@b.com' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/public/signup')
      .send({ ...VALID_BODY, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});

describe('POST /api/public/signup — proxy behavior', () => {
  it('returns 200 and forwards billing JSON on success', async () => {
    const billingReply = {
      ok: true,
      email: VALID_BODY.email,
      tempPassword: 'Temp@9876',
      loginUrl: 'https://fireguard.iotsoft.in/app',
      trialEndsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    mockFetch(200, billingReply);

    const res = await request(app)
      .post('/api/public/signup')
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.email).toBe(VALID_BODY.email);
    expect(res.body.tempPassword).toBe('Temp@9876');
  });

  it('returns 409 when billing returns 409 (duplicate account)', async () => {
    mockFetch(409, { ok: false, error: 'duplicate' });

    const res = await request(app)
      .post('/api/public/signup')
      .send(VALID_BODY);

    expect(res.status).toBe(409);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('already exists');
  });

  it('returns 502 when billing returns 500', async () => {
    mockFetch(500, { ok: false, error: 'internal server error' });

    const res = await request(app)
      .post('/api/public/signup')
      .send(VALID_BODY);

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('unavailable');
  });

  it('returns 502 when fetch throws a network error', async () => {
    mockFetchNetworkError();

    const res = await request(app)
      .post('/api/public/signup')
      .send(VALID_BODY);

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('unavailable');
  });
});
