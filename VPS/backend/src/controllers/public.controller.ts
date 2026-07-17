/**
 * Public controller — self-serve signup proxy.
 *
 * POST /api/public/signup
 *   Forwards the signup body to the billing platform and returns the result.
 *   No user auth required (public route).
 */
import type { Request, Response } from 'express';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import type { SignupBody } from '../validation/public.schema';

const SIGNUP_TIMEOUT_MS = 15_000;

export const signup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { companyName, contactName, phone, email } = req.body as SignupBody;

  const billingUrl = `${env.BILLING_BASE}/api/fireguard/signup`;

  let billingResponse: globalThis.Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SIGNUP_TIMEOUT_MS);

    billingResponse = await globalThis.fetch(billingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, contactName, phone, email }),
      signal: controller.signal,
    });

    clearTimeout(timer);
  } catch {
    res.status(502).json({ ok: false, error: 'Signup is temporarily unavailable, please try again.' });
    return;
  }

  if (billingResponse.status === 409) {
    res.status(409).json({ ok: false, error: 'An account already exists for this email or phone.' });
    return;
  }

  if (!billingResponse.ok) {
    res.status(502).json({ ok: false, error: 'Signup is temporarily unavailable, please try again.' });
    return;
  }

  // Forward billing response: { ok, email, tempPassword, loginUrl, trialEndsAt }
  const data: unknown = await billingResponse.json();
  res.json(data);
});
