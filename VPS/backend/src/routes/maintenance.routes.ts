/**
 * Maintenance log routes.
 * GET  /api/maintenance      — all roles
 * GET  /api/maintenance/:id  — all roles (own site)
 * POST /api/maintenance      — MAINTENANCE_USER+
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { subscriptionGate } from '../middleware/subscriptionGate';
import {
  MaintenanceQuerySchema,
  MaintenanceParamsSchema,
  CreateMaintenanceLogSchema,
} from '../validation/maintenance.schema';
import {
  listMaintenanceLogs,
  getMaintenanceLog,
  createMaintenanceLog,
} from '../controllers/maintenance.controller';

const router = Router();

router.use(authenticate);
router.use(subscriptionGate);

router.get('/', validate({ query: MaintenanceQuerySchema }), listMaintenanceLogs);
router.get('/:id', validate({ params: MaintenanceParamsSchema }), getMaintenanceLog);
router.post(
  '/',
  requireRole('MAINTENANCE_USER'),
  validate({ body: CreateMaintenanceLogSchema }),
  createMaintenanceLog
);

export default router;
