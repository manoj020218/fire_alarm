/**
 * Maintenance controller — log CRUD (MAINTENANCE_USER and above can create).
 */
import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { MaintenanceLog, type IMaintenanceLogDocument } from '../models/MaintenanceLog';
import { writeAudit } from '../services/audit.service';
import { scopeFilter, canAccessSite } from '../utils/scope';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import type { CreateMaintenanceLogBody, MaintenanceQuery } from '../validation/maintenance.schema';

// ── GET /api/maintenance ──────────────────────────────────────────────────────

export const listMaintenanceLogs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw AppError.unauthorized();
    const q = req.query as unknown as MaintenanceQuery;
    const { siteId, gatewayId, deviceId, type, page, limit } = q;

    const baseFilter: FilterQuery<IMaintenanceLogDocument> = {};
    if (siteId !== undefined) baseFilter['siteId'] = siteId;
    if (gatewayId !== undefined) baseFilter['gatewayId'] = gatewayId;
    if (deviceId !== undefined) baseFilter['deviceId'] = deviceId;
    if (type !== undefined) baseFilter['type'] = type;

    const scopedFilter = scopeFilter<IMaintenanceLogDocument>(req.user, baseFilter);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      MaintenanceLog.find(scopedFilter).sort({ performedAt: -1 }).skip(skip).limit(limit),
      MaintenanceLog.countDocuments(scopedFilter),
    ]);

    res.json({
      ok: true,
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }
);

// ── GET /api/maintenance/:id ──────────────────────────────────────────────────

export const getMaintenanceLog = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw AppError.unauthorized();
    const { id } = req.params as { id: string };

    const log = await MaintenanceLog.findById(id);
    if (!log) throw AppError.notFound('MaintenanceLog');
    if (!canAccessSite(req.user, log.siteId)) throw AppError.forbidden();

    res.json({ ok: true, log });
  }
);

// ── POST /api/maintenance ─────────────────────────────────────────────────────

export const createMaintenanceLog = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw AppError.unauthorized();
    const body = req.body as CreateMaintenanceLogBody;

    if (!canAccessSite(req.user, body.siteId)) throw AppError.forbidden();

    const log = await MaintenanceLog.create({
      ...body,
      performedBy: req.user.sub,
    });

    await writeAudit({
      action: 'CREATE',
      entity: 'MaintenanceLog',
      entityId: String(log._id),
      after: log.toObject(),
      req,
    });

    res.status(201).json({ ok: true, log });
  }
);
