/**
 * Auth routes.
 * POST /api/auth/login  — rate-limited
 * POST /api/auth/refresh
 * POST /api/auth/logout  — requires auth
 * GET  /api/auth/me      — requires auth
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { LoginSchema, RefreshSchema, GoogleLoginSchema } from '../validation/auth.schema';
import { login, googleLogin, refresh, logout, me } from '../controllers/auth.controller';
import { env } from '../config/env';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, code: 'RATE_LIMITED', message: 'Too many login attempts, please try later.' },
});

router.post('/login', loginLimiter, validate({ body: LoginSchema }), login);
router.post('/google', loginLimiter, validate({ body: GoogleLoginSchema }), googleLogin);
router.post('/refresh', validate({ body: RefreshSchema }), refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

export default router;
