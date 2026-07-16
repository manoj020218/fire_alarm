/**
 * Sites controller — CRUD for site records.
 * Create/delete restricted to SUPER_ADMIN / VENDOR_ADMIN.
 */
import type { Request, Response } from 'express';
import { Site, type ISiteDocument } from '../models/Site';
import { writeAudit } from '../services/audit.service';
import { scopeFilter, canAccessSite } from '../utils/scope';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import type { CreateSiteBody, UpdateSiteBody } from '../validation/sites.schema';

// ── GET /api/sites ────────────────────────────────────────────────────────────

export const listSites = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const filter = scopeFilter<ISiteDocument>(req.user, { active: true });
  const sites = await Site.find(filter).sort({ name: 1 });
  res.json({ ok: true, sites });
});

// ── GET /api/sites/:siteId ────────────────────────────────────────────────────

export const getSite = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { siteId } = req.params as { siteId: string };

  if (!canAccessSite(req.user, siteId)) throw AppError.forbidden();

  const site = await Site.findOne({ siteId });
  if (!site) throw AppError.notFound('Site');

  res.json({ ok: true, site });
});

// ── POST /api/sites ───────────────────────────────────────────────────────────

export const createSite = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const body = req.body as CreateSiteBody;

  const site = await Site.create({ ...body });

  await writeAudit({
    action: 'CREATE',
    entity: 'Site',
    entityId: site.siteId,
    after: site.toObject(),
    req,
  });

  res.status(201).json({ ok: true, site });
});

// ── PUT /api/sites/:siteId ────────────────────────────────────────────────────

export const updateSite = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { siteId } = req.params as { siteId: string };
  const body = req.body as UpdateSiteBody;

  const before = await Site.findOne({ siteId });
  if (!before) throw AppError.notFound('Site');

  const site = await Site.findOneAndUpdate({ siteId }, { $set: body }, { new: true });

  await writeAudit({
    action: 'UPDATE',
    entity: 'Site',
    entityId: siteId,
    before: before.toObject(),
    after: site?.toObject(),
    req,
  });

  res.json({ ok: true, site });
});

// ── DELETE /api/sites/:siteId (soft-delete) ───────────────────────────────────

export const deleteSite = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { siteId } = req.params as { siteId: string };

  const site = await Site.findOne({ siteId });
  if (!site) throw AppError.notFound('Site');

  await Site.findOneAndUpdate({ siteId }, { $set: { active: false } });

  await writeAudit({
    action: 'DELETE',
    entity: 'Site',
    entityId: siteId,
    before: site.toObject(),
    req,
  });

  res.json({ ok: true, message: 'Site deactivated' });
});
