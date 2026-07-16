/**
 * Device routes — nested under gateways.
 * Mounted at /api/gateways/:gatewayId/devices
 * (mergeParams: true so :gatewayId is visible)
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  GatewayDevicesParamsSchema,
  DeviceParamsSchema,
  CreateDeviceSchema,
  UpdateDeviceSchema,
} from '../validation/devices.schema';
import {
  listDevices,
  getDevice,
  createDevice,
  updateDevice,
  deleteDevice,
} from '../controllers/devices.controller';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', validate({ params: GatewayDevicesParamsSchema }), listDevices);
router.get('/:deviceId', validate({ params: DeviceParamsSchema }), getDevice);
router.post(
  '/',
  requireRole('CLIENT_ADMIN'),
  validate({ params: GatewayDevicesParamsSchema, body: CreateDeviceSchema }),
  createDevice
);
router.put(
  '/:deviceId',
  requireRole('CLIENT_ADMIN'),
  validate({ params: DeviceParamsSchema, body: UpdateDeviceSchema }),
  updateDevice
);
router.delete(
  '/:deviceId',
  requireRole('CLIENT_ADMIN'),
  validate({ params: DeviceParamsSchema }),
  deleteDevice
);

export default router;
