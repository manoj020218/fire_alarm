/**
 * billingBridge — outbound calls to the billing platform.
 * Best-effort: failures are logged, never thrown (FireGuard stays authoritative
 * for the customer-facing trial state).
 *
 * POST ${BILLING_BASE}/api/fireguard/activate
 *   headers: { X-Bridge-Secret }
 *   body:    { siteId, trialEndsAt }
 */
import { env } from '../config/env';
import logger from '../config/logger';

const FETCH_TIMEOUT_MS = 10_000;

/** Tell billing the trial has started for a site (first gateway activated). */
export async function notifyBillingActivation(siteId: string, trialEndsAt: Date): Promise<void> {
  const url = `${env.BILLING_BASE}/api/fireguard/activate`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Secret': env.BRIDGE_SECRET,
      },
      body: JSON.stringify({ siteId, trialEndsAt: trialEndsAt.toISOString() }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      logger.warn({ siteId, status: resp.status }, 'billingBridge: activate non-2xx');
    } else {
      logger.info({ siteId }, 'billingBridge: activation reported to billing');
    }
  } catch (err) {
    logger.warn({ err, siteId }, 'billingBridge: activate call failed (non-fatal)');
  } finally {
    clearTimeout(timeoutId);
  }
}
