/**
 * Push controller — register / unregister an FCM device token for the caller.
 */
import type { Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { registerToken, removeToken, isPushEnabled } from '../services/pushService';
import type { RegisterPushBody, UnregisterPushBody } from '../validation/push.schema';

// ── POST /api/push/register ───────────────────────────────────────────────────
export const registerPush = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { token, platform } = req.body as RegisterPushBody;
  await registerToken(req.user.sub, req.user.siteIds ?? [], token, platform);
  res.json({ ok: true, enabled: isPushEnabled() });
});

// ── POST /api/push/unregister ─────────────────────────────────────────────────
export const unregisterPush = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { token } = req.body as UnregisterPushBody;
  await removeToken(token);
  res.json({ ok: true });
});
