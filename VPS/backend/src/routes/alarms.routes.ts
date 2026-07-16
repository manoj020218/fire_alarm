/**
 * Alarms routes.
 * GET  /api/alarms        — all roles
 * POST /api/alarms/:id/ack — MAINTENANCE_USER+
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { AlarmQuerySchema, AlarmParamsSchema, AckAlarmSchema } from '../validation/alarms.schema';
import { listAlarms, ackAlarm } from '../controllers/alarms.controller';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: AlarmQuerySchema }), listAlarms);
router.post(
  '/:id/ack',
  requireRole('MAINTENANCE_USER'),
  validate({ params: AlarmParamsSchema, body: AckAlarmSchema }),
  ackAlarm
);

export default router;
