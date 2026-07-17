/**
 * Subscription routes.
 *
 * GET /api/subscription  — dashboard banner (auth required)
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getSubscription } from '../controllers/subscription.controller';

const router = Router();

router.use(authenticate);

router.get('/', getSubscription);

export default router;
