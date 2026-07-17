/**
 * Usage reporter — daily job that sends per-site device + gateway counts to the
 * billing platform so it can track per-device usage for invoicing.
 *
 * Runs once ~60 s after boot and then every 24 h.
 * Best-effort: ALL errors are caught and logged — never crashes the process.
 *
 * POST ${BILLING_BASE}/api/fireguard/usage
 *   headers: { X-Bridge-Secret }
 *   body:    { siteId, deviceCount, gatewayCount }
 */
import { Site } from '../models/Site';
import { Device } from '../models/Device';
import { Gateway } from '../models/Gateway';
import { env } from '../config/env';
import logger from '../config/logger';

const BOOT_DELAY_MS  = 60_000;          // 1 minute
const INTERVAL_MS    = 24 * 60 * 60_000; // 24 hours
const FETCH_TIMEOUT_MS = 10_000;         // 10 seconds per request

let bootTimer: ReturnType<typeof setTimeout> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

/** Send usage for a single site. */
async function reportSite(siteId: string): Promise<void> {
  const [deviceCount, gatewayCount] = await Promise.all([
    Device.countDocuments({ siteId, active: true }),
    Gateway.countDocuments({ siteId }),
  ]);

  const url = `${env.BILLING_BASE}/api/fireguard/usage`;
  const body = JSON.stringify({ siteId, deviceCount, gatewayCount });

  // Node 20 global fetch with AbortController timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Secret': env.BRIDGE_SECRET,
      },
      body,
      signal: controller.signal,
    });
    if (!resp.ok) {
      logger.warn({ siteId, status: resp.status }, 'usageReporter: billing responded non-2xx');
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Report usage for ALL active sites. */
export async function reportAllSites(): Promise<void> {
  try {
    const sites = await Site.find({ active: true }).select('siteId').lean();
    for (const site of sites) {
      try {
        await reportSite(site.siteId);
        logger.debug({ siteId: site.siteId }, 'usageReporter: reported');
      } catch (err) {
        logger.error({ err, siteId: site.siteId }, 'usageReporter: failed for site');
      }
    }
  } catch (err) {
    logger.error({ err }, 'usageReporter: failed to enumerate sites');
  }
}

/** Start the usage reporter. Idempotent. */
export function startUsageReporter(): void {
  if (bootTimer !== null || intervalId !== null) return;

  bootTimer = setTimeout(() => {
    void reportAllSites();
    intervalId = setInterval(() => { void reportAllSites(); }, INTERVAL_MS);
    logger.info({ intervalMs: INTERVAL_MS }, 'usageReporter: daily interval started');
  }, BOOT_DELAY_MS);

  logger.info({ bootDelayMs: BOOT_DELAY_MS }, 'usageReporter: scheduled (first run after boot delay)');
}

/** Stop the usage reporter (called during graceful shutdown). */
export function stopUsageReporter(): void {
  if (bootTimer !== null) {
    clearTimeout(bootTimer);
    bootTimer = null;
  }
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('usageReporter: stopped');
  }
}
