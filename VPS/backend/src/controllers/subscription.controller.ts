/**
 * Subscription controller.
 *
 * GET /api/subscription  — returns the caller's site subscription status + daysLeft.
 *   Used by the dashboard banner to show trial/expiry warnings.
 */
import type { Request, Response } from 'express';
import { Site } from '../models/Site';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { getSubscriptionState } from '../services/subscription.service';

export const getSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();

  // Super roles have no site restriction — report 'active' with no countdown
  if (req.user.role === 'JENIX_SUPER_ADMIN' || req.user.role === 'VENDOR_ADMIN') {
    res.json({ ok: true, subscription: { status: 'active', daysLeft: null } });
    return;
  }

  const [siteId] = req.user.siteIds;
  if (!siteId) {
    throw AppError.notFound('Site (no siteId on user)');
  }

  const site = await Site.findOne({ siteId });
  if (!site) {
    throw AppError.notFound('Site');
  }

  const state = getSubscriptionState(site);

  res.json({
    ok: true,
    subscription: {
      siteId,
      status: state.status,
      daysLeft: state.daysLeft,
    },
  });
});
