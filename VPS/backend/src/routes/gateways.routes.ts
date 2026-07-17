/**
 * Gateways routes.
 * GET    /api/gateways            — all roles
 * GET    /api/gateways/:id        — all roles
 * PUT    /api/gateways/:id        — CLIENT_ADMIN+
 * GET    /api/gateways/:id/config — all roles
 * PUT    /api/gateways/:id/config — CLIENT_ADMIN+
 * POST   /api/gateways/:id/command — CLIENT_ADMIN+
 * POST   /api/gateways/:id/token  — SUPER_ADMIN only
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { subscriptionGate } from '../middleware/subscriptionGate';
import {
  GatewayParamsSchema,
  UpdateGatewaySchema,
  GatewayConfigSchema,
  GatewayCommandSchema,
  ClaimGatewaySchema,
  PoolGatewaySchema,
} from '../validation/gateways.schema';
import {
  listGateways,
  getGateway,
  updateGateway,
  getGatewayConfig,
  putGatewayConfig,
  sendGatewayCommand,
  rotateDeviceToken,
  claimGateway,
  createPoolGateway,
} from '../controllers/gateways.controller';

const router = Router();

router.use(authenticate);
router.use(subscriptionGate);

// Static paths must precede '/:id' so they are not captured as an id.
router.post(
  '/claim',
  requireRole('CLIENT_ADMIN'),
  validate({ body: ClaimGatewaySchema }),
  claimGateway
);
router.post(
  '/pool',
  requireRole('JENIX_SUPER_ADMIN'),
  validate({ body: PoolGatewaySchema }),
  createPoolGateway
);

router.get('/', listGateways);
router.get('/:id', validate({ params: GatewayParamsSchema }), getGateway);
router.put(
  '/:id',
  requireRole('CLIENT_ADMIN'),
  validate({ params: GatewayParamsSchema, body: UpdateGatewaySchema }),
  updateGateway
);

router.get('/:id/config', validate({ params: GatewayParamsSchema }), getGatewayConfig);
router.put(
  '/:id/config',
  requireRole('CLIENT_ADMIN'),
  validate({ params: GatewayParamsSchema, body: GatewayConfigSchema }),
  putGatewayConfig
);

router.post(
  '/:id/command',
  requireRole('CLIENT_ADMIN'),
  validate({ params: GatewayParamsSchema, body: GatewayCommandSchema }),
  sendGatewayCommand
);

router.post(
  '/:id/token',
  requireRole('JENIX_SUPER_ADMIN'),
  validate({ params: GatewayParamsSchema }),
  rotateDeviceToken
);

export default router;
