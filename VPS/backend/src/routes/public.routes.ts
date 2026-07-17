/**
 * Public routes — no auth required.
 *
 * POST /api/public/signup  — self-serve signup proxy to billing platform
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.middleware';
import { SignupBodySchema } from '../validation/public.schema';
import { signup } from '../controllers/public.controller';
import { env } from '../config/env';

const router = Router();

// Tighter rate limit for signup: 10 per 15-min window per IP
const signupLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, code: 'RATE_LIMITED', message: 'Too many signup attempts, please try later.' },
});

router.post('/signup', signupLimiter, validate({ body: SignupBodySchema }), signup);

export default router;
