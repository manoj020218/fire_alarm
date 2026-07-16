/**
 * Device HTTP contract routes — /api/fireguard.
 * All routes require deviceAuth (X-Gateway-Id + X-Gateway-Token).
 *
 * POST   /api/fireguard/ingest           — telemetry HTTP fallback
 * POST   /api/fireguard/alarm            — alarm HTTP fallback
 * POST   /api/fireguard/backup           — pre-OTA backup (durable)
 * GET    /api/fireguard/ota/manifest     — check for firmware update
 * GET    /api/fireguard/ota/binary/:hw/:version — serve .bin file
 */
import { Router } from 'express';
import { deviceAuth } from '../middleware/deviceAuth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  BackupBodySchema,
  OtaManifestQuerySchema,
  OtaBinaryParamsSchema,
} from '../validation/device.schema';
import {
  deviceIngest,
  deviceAlarm,
  deviceBackup,
  otaManifest,
  otaBinary,
} from '../controllers/device.controller';

const router = Router();

// All device routes require device auth
router.use(deviceAuth);

// Telemetry HTTP fallback
router.post('/ingest', deviceIngest);

// Alarm HTTP fallback
router.post('/alarm', deviceAlarm);

// Pre-OTA backup — must succeed before OTA proceeds
router.post('/backup', validate({ body: BackupBodySchema }), deviceBackup);

// OTA manifest — returns update JSON or 204 if up to date
router.get(
  '/ota/manifest',
  validate({ query: OtaManifestQuerySchema }),
  otaManifest
);

// OTA binary download
router.get(
  '/ota/binary/:hw/:version',
  validate({ params: OtaBinaryParamsSchema }),
  otaBinary
);

export default router;
