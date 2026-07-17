/**
 * Subscription gate middleware.
 *
 * Blocks MUTATING management routes (POST / PUT / PATCH / DELETE) when the
 * caller's site subscription is 'expired' or 'suspended'.
 *
 * NEVER blocks:
 *  - GET requests (read-only)
 *  - /api/auth/*          (login / refresh even after expiry)
 *  - /api/subscription    (so the dashboard banner can still load)
 *  - /api/fireguard/*     (device telemetry / alarm / backup ingest — safety-critical)
 *  - /api/bridge/*        (billing system callbacks)
 *  - Alarm ACK  POST /api/alarms/:id/ack  (safety — must allow ack even when expired)
 *
 * Must run AFTER authenticate so req.user is available.
 * Apply it only to the management routes (see app.ts).
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { Site } from '../models/Site';
import { getSubscriptionState } from '../services/subscription.service';
import logger from '../config/logger';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Paths that are always permitted regardless of subscription state.
// Checked with startsWith — keep them specific.
const ALWAYS_ALLOWED_PREFIXES = [
  '/api/auth',
  '/api/subscription',
  '/api/fireguard',   // device telemetry / alarm / backup ingest
  '/api/bridge',
];

// Specific path patterns that are always allowed even when subscription is expired.
// Alarm ACK: POST /api/alarms/:id/ack
function isAlwaysAllowedPath(path: string, method: string): boolean {
  // Alarm ACK — POST /api/alarms/<anything>/ack
  if (method === 'POST' && /^\/api\/alarms\/[^/]+\/ack$/i.test(path)) {
    return true;
  }
  for (const prefix of ALWAYS_ALLOWED_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

export const subscriptionGate: RequestHandler = (async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Let read-only and always-allowed paths through immediately
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  if (isAlwaysAllowedPath(req.path, req.method)) {
    next();
    return;
  }

  // No user = let the auth middleware handle the 401
  if (!req.user) {
    next();
    return;
  }

  // Super / vendor roles are never gated
  if (req.user.role === 'JENIX_SUPER_ADMIN' || req.user.role === 'VENDOR_ADMIN') {
    next();
    return;
  }

  const [siteId] = req.user.siteIds;
  if (!siteId) {
    next();
    return;
  }

  try {
    const site = await Site.findOne({ siteId }).lean();
    if (!site) {
      next();
      return;
    }

    const { status } = getSubscriptionState(site);

    if (status === 'expired' || status === 'suspended') {
      logger.warn(
        { siteId, status, method: req.method, path: req.path },
        'subscriptionGate: blocking mutating request'
      );
      res.status(402).json({
        ok: false,
        code: 'SUBSCRIPTION_EXPIRED',
        error:
          status === 'suspended'
            ? 'Your site has been suspended. Please contact support to reactivate.'
            : 'Your trial has expired. Please renew your subscription to continue managing this site.',
      });
      return;
    }
  } catch (err) {
    // Best-effort: if we can't check the subscription, let the request through
    // (don't take down the whole API over a billing lookup failure)
    logger.error({ err, siteId }, 'subscriptionGate: DB error checking subscription — allowing request');
  }

  next();
}) as RequestHandler;
