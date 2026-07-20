/**
 * Public OTA routes (no device auth) — mounted at /api/fireguard/ota BEFORE the
 * device-auth router so these win. See otaPublic.controller for rationale.
 */
import { Router } from 'express';
import { otaManifestPublic, otaDownloadPublic } from '../controllers/otaPublic.controller';

const router = Router();

router.get('/manifest', otaManifestPublic);
router.get('/download/:hw/:version', otaDownloadPublic);

export default router;
