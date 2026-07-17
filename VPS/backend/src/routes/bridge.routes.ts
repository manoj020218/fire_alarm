/**
 * Billing bridge routes — server-to-server only, authenticated via X-Bridge-Secret.
 *
 * POST /api/bridge/provision  — billing platform provisions a new org + admin user
 */
import { Router } from 'express';
import { bridgeAuth } from '../middleware/bridgeAuth';
import { validate } from '../middleware/validate.middleware';
import { ProvisionBodySchema } from '../validation/bridge.schema';
import { provision } from '../controllers/bridge.controller';

const router = Router();

// All bridge routes require the shared secret
router.use(bridgeAuth);

router.post('/provision', validate({ body: ProvisionBodySchema }), provision);

export default router;
