/**
 * Telemetry routes — read-only.
 * GET /api/telemetry/:gatewayId/latest
 * GET /api/telemetry/:gatewayId/range
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { TelemetryParamsSchema, TelemetryRangeQuerySchema } from '../validation/telemetry.schema';
import { getLatestTelemetry, getTelemetryRange } from '../controllers/telemetry.controller';

const router = Router();

router.use(authenticate);

router.get('/:gatewayId/latest', validate({ params: TelemetryParamsSchema }), getLatestTelemetry);
router.get(
  '/:gatewayId/range',
  validate({ params: TelemetryParamsSchema, query: TelemetryRangeQuerySchema }),
  getTelemetryRange
);

export default router;
