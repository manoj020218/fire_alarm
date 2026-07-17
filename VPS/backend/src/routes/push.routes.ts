/**
 * Push routes.
 * POST /api/push/register    — any authenticated user
 * POST /api/push/unregister  — any authenticated user
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { RegisterPushSchema, UnregisterPushSchema } from '../validation/push.schema';
import { registerPush, unregisterPush } from '../controllers/push.controller';

const router = Router();

router.use(authenticate);

router.post('/register', validate({ body: RegisterPushSchema }), registerPush);
router.post('/unregister', validate({ body: UnregisterPushSchema }), unregisterPush);

export default router;
