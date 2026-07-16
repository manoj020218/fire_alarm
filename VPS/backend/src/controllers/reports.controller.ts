/**
 * Reports controller — generate (CSV real, PDF stub) + list.
 */
import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { Report, type IReportDocument } from '../models/Report';
import { Alarm } from '../models/Alarm';
import { Telemetry } from '../models/Telemetry';
import { writeAudit } from '../services/audit.service';
import { buildCsv } from '../services/csv.service';
import { canAccessSite, scopeFilter } from '../utils/scope';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import type { GenerateReportBody, ReportQuery } from '../validation/reports.schema';

// ── POST /api/reports/generate ────────────────────────────────────────────────

export const generateReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const body = req.body as GenerateReportBody;

  if (!canAccessSite(req.user, body.siteId)) throw AppError.forbidden();

  if (body.rangeFrom >= body.rangeTo) {
    throw AppError.badRequest('rangeFrom must be before rangeTo');
  }

  if (body.format === 'pdf') {
    // PDF is a minimal stub — Phase 2C can integrate pdfkit fully
    res.status(501).json({
      ok: false,
      code: 'NOT_IMPLEMENTED',
      message: 'PDF generation is not yet implemented. Use format=csv.',
    });
    return;
  }

  // Create report record
  const report = await Report.create({
    siteId: body.siteId,
    type: body.type,
    format: body.format,
    status: 'generating',
    requestedBy: req.user.sub,
    requestedAt: new Date(),
    rangeFrom: body.rangeFrom,
    rangeTo: body.rangeTo,
  });

  let csvContent = '';

  try {
    if (body.type === 'alarm_summary') {
      const alarms = await Alarm.find({
        siteId: body.siteId,
        timestamp: { $gte: body.rangeFrom, $lte: body.rangeTo },
      })
        .sort({ timestamp: -1 })
        .limit(5000);

      const rows = alarms.map((a) => ({
        alarmId: a.alarmId,
        deviceId: a.deviceId,
        parameter: a.parameter,
        severity: a.severity,
        value: String(a.value),
        active: String(a.active),
        acknowledged: String(a.acknowledged),
        acknowledgedBy: a.acknowledgedBy ?? '',
        acknowledgeReason: a.acknowledgeReason ?? '',
        timestamp: a.timestamp.toISOString(),
      }));

      csvContent = buildCsv(rows);
    } else {
      // Default: telemetry summary
      const telemetry = await Telemetry.find({
        siteId: body.siteId,
        timestamp: { $gte: body.rangeFrom, $lte: body.rangeTo },
      })
        .sort({ timestamp: 1 })
        .limit(5000);

      const rows = telemetry.map((t) => ({
        gatewayId: t.gatewayId,
        timestamp: t.timestamp.toISOString(),
        uptime: t.system.uptime,
        fw: t.system.fw,
        uplink: t.system.uplink,
        rssi: t.system.rssi ?? '',
        rs485: t.system.rs485,
        mqtt: t.system.mqtt,
      }));

      csvContent = buildCsv(rows);
    }

    await Report.findByIdAndUpdate(report._id, {
      $set: {
        status: 'ready',
        completedAt: new Date(),
        fileSize: Buffer.byteLength(csvContent, 'utf8'),
      },
    });
  } catch (err) {
    await Report.findByIdAndUpdate(report._id, {
      $set: { status: 'failed', error: String(err) },
    });
    throw AppError.internal('Report generation failed');
  }

  await writeAudit({
    action: 'CREATE',
    entity: 'Report',
    entityId: String(report._id),
    after: { type: body.type, format: body.format, siteId: body.siteId },
    req,
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="report-${body.type}-${Date.now()}.csv"`
  );
  res.status(200).send(csvContent);
});

// ── GET /api/reports ──────────────────────────────────────────────────────────

export const listReports = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const q = req.query as unknown as ReportQuery;
  const { siteId, page, limit } = q;

  const baseFilter: FilterQuery<IReportDocument> = {};
  if (siteId !== undefined) baseFilter['siteId'] = siteId;

  const scopedFilter = scopeFilter<IReportDocument>(req.user, baseFilter);
  const skip = (page - 1) * limit;

  const [reports, total] = await Promise.all([
    Report.find(scopedFilter).sort({ requestedAt: -1 }).skip(skip).limit(limit),
    Report.countDocuments(scopedFilter),
  ]);

  res.json({
    ok: true,
    reports,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});
