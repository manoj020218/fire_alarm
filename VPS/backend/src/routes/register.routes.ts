/**
 * Public device registration route — mounted at /api/fireguard/register BEFORE
 * the device-auth router so it is reachable without a token (it establishes one).
 */
import { Router } from 'express';
import { registerDevice } from '../controllers/register.controller';

const router = Router();

router.post('/', registerDevice);

export default router;
