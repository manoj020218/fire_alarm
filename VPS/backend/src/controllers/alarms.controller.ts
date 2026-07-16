/**
 * Alarms controller — list with filters/pagination + acknowledge.
 */
import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { Alarm, type IAlarmDocument } from '../models/Alarm';
import { writeAudit } from '../services/audit.service';
import { scopeFilter } from '../utils/scope';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import type { AlarmQuery, AckAlarmBody } from '../validation/alarms.schema';

// ── GET /api/alarms ───────────────────────────────────────────────────────────

export const listAlarms = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();

  const q = req.query as unknown as AlarmQuery;
  const { siteId, gatewayId, severity, active, acknowledged, page, limit } = q;

  const baseFilter: FilterQuery<IAlarmDocument> = {};
  if (siteId !== undefined) baseFilter['siteId'] = siteId;
  if (gatewayId !== undefined) baseFilter['gatewayId'] = gatewayId;
  if (severity !== undefined) baseFilter['severity'] = severity;
  if (active !== undefined) baseFilter['active'] = active;
  if (acknowledged !== undefined) baseFilter['acknowledged'] = acknowledged;

  const scopedFilter = scopeFilter<IAlarmDocument>(req.user, baseFilter);
  const skip = (page - 1) * limit;

  const [alarms, total] = await Promise.all([
    Alarm.find(scopedFilter).sort({ timestamp: -1 }).skip(skip).limit(limit),
    Alarm.countDocuments(scopedFilter),
  ]);

  res.json({
    ok: true,
    alarms,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ── POST /api/alarms/:id/ack ──────────────────────────────────────────────────

export const ackAlarm = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as { id: string };
  const { reason } = req.body as AckAlarmBody;

  const alarm = await Alarm.findById(id);
  if (!alarm) throw AppError.notFound('Alarm');

  // Tenant check — non-super roles must own the site
  const superRoles = ['JENIX_SUPER_ADMIN', 'VENDOR_ADMIN'] as const;
  if (!superRoles.includes(req.user.role as (typeof superRoles)[number])) {
    if (!req.user.siteIds.includes(alarm.siteId)) {
      throw AppError.forbidden('Access to this alarm is denied');
    }
  }

  if (alarm.acknowledged) {
    throw AppError.conflict('Alarm already acknowledged');
  }

  const before = alarm.toObject();

  alarm.acknowledged = true;
  alarm.acknowledgedBy = req.user.sub;
  alarm.acknowledgedAt = new Date();
  alarm.acknowledgeReason = reason;
  alarm.active = false;
  await alarm.save();

  await writeAudit({
    action: 'ACK_ALARM',
    entity: 'Alarm',
    entityId: String(alarm._id),
    before,
    after: alarm.toObject(),
    req,
  });

  res.json({ ok: true, alarm });
});
