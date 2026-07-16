/**
 * Telemetry controller — latest reading + range query with downsampling.
 */
import type { Request, Response } from 'express';
import { Telemetry } from '../models/Telemetry';
import { Gateway } from '../models/Gateway';
import { canAccessSite } from '../utils/scope';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import type { TelemetryRangeQuery } from '../validation/telemetry.schema';

// ── GET /api/telemetry/:gatewayId/latest ─────────────────────────────────────

export const getLatestTelemetry = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw AppError.unauthorized();
    const { gatewayId } = req.params as { gatewayId: string };

    const gateway = await Gateway.findOne({ gatewayId });
    if (!gateway) throw AppError.notFound('Gateway');
    if (!canAccessSite(req.user, gateway.siteId)) throw AppError.forbidden();

    const telemetry = await Telemetry.findOne({ gatewayId }).sort({ timestamp: -1 });
    if (!telemetry) throw AppError.notFound('Telemetry');

    res.json({ ok: true, telemetry });
  }
);

// ── GET /api/telemetry/:gatewayId/range ───────────────────────────────────────

export const getTelemetryRange = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw AppError.unauthorized();
    const { gatewayId } = req.params as { gatewayId: string };
    const { from, to, limit } = req.query as unknown as TelemetryRangeQuery;

    const gateway = await Gateway.findOne({ gatewayId });
    if (!gateway) throw AppError.notFound('Gateway');
    if (!canAccessSite(req.user, gateway.siteId)) throw AppError.forbidden();

    if (from >= to) {
      throw AppError.badRequest('from must be before to');
    }

    // Fetch up to limit docs; if the raw count would exceed limit, downsample by
    // fetching every Nth row so the client always gets at most `limit` points.
    const total = await Telemetry.countDocuments({
      gatewayId,
      timestamp: { $gte: from, $lte: to },
    });

    const docs = await Telemetry.find({
      gatewayId,
      timestamp: { $gte: from, $lte: to },
    })
      .sort({ timestamp: 1 })
      .limit(limit);

    // Downsample: if we have more total docs than limit, keep evenly-spaced entries
    let result = docs;
    if (total > limit && docs.length > 1) {
      const step = Math.ceil(docs.length / limit);
      result = docs.filter((_, i) => i % step === 0);
    }

    res.json({
      ok: true,
      gatewayId,
      from,
      to,
      total,
      count: result.length,
      telemetry: result,
    });
  }
);
