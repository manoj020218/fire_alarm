/**
 * Sites routes.
 * GET    /api/sites           — all roles
 * GET    /api/sites/:siteId   — all roles (own sites)
 * POST   /api/sites           — SUPER_ADMIN / VENDOR_ADMIN
 * PUT    /api/sites/:siteId   — SUPER_ADMIN / VENDOR_ADMIN
 * DELETE /api/sites/:siteId   — SUPER_ADMIN only
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { subscriptionGate } from '../middleware/subscriptionGate';
import { SiteParamsSchema, CreateSiteSchema, UpdateSiteSchema } from '../validation/sites.schema';
import {
  listSites,
  getSite,
  createSite,
  updateSite,
  deleteSite,
} from '../controllers/sites.controller';

const router = Router();

router.use(authenticate);
router.use(subscriptionGate);

router.get('/', listSites);
router.get('/:siteId', validate({ params: SiteParamsSchema }), getSite);
router.post('/', requireRole('VENDOR_ADMIN'), validate({ body: CreateSiteSchema }), createSite);
router.put(
  '/:siteId',
  requireRole('VENDOR_ADMIN'),
  validate({ params: SiteParamsSchema, body: UpdateSiteSchema }),
  updateSite
);
router.delete(
  '/:siteId',
  requireRole('JENIX_SUPER_ADMIN'),
  validate({ params: SiteParamsSchema }),
  deleteSite
);

export default router;
