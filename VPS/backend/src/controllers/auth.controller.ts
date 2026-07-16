/**
 * Auth controller — login, refresh, logout, me.
 */
import type { Request, Response } from 'express';
import { User } from '../models/User';
import {
  comparePassword,
  signAccessToken,
  signRefreshToken,
  refreshAccessToken,
} from '../services/auth.service';
import { writeAudit } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import type { LoginBody, RefreshBody } from '../validation/auth.schema';

// ── POST /api/auth/login ──────────────────────────────────────────────────────

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as LoginBody;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !user.active) {
    throw AppError.unauthorized('Invalid credentials');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized('Invalid credentials');
  }

  const tokenBase = {
    sub: String(user._id),
    email: user.email,
    role: user.role,
    siteIds: user.siteIds,
  };

  const accessToken = signAccessToken(tokenBase);
  const refreshToken = signRefreshToken(tokenBase);

  user.lastLoginAt = new Date();
  await user.save();

  await writeAudit({ action: 'LOGIN', entity: 'User', entityId: String(user._id), req });

  res.json({
    ok: true,
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      siteIds: user.siteIds,
    },
  });
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────

export const refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as RefreshBody;

  let accessToken: string;
  try {
    accessToken = refreshAccessToken(refreshToken);
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  res.json({ ok: true, accessToken });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Stateless JWT: instruct client to discard tokens.
  // Phase 2C may add a token revocation list.
  await writeAudit({ action: 'LOGOUT', entity: 'User', entityId: req.user?.sub, req });
  res.json({ ok: true, message: 'Logged out' });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

export const me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();

  const user = await User.findById(req.user.sub);
  if (!user || !user.active) throw AppError.notFound('User');

  res.json({
    ok: true,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      siteIds: user.siteIds,
      lastLoginAt: user.lastLoginAt,
    },
  });
});
