/**
 * Auth service — password hashing and JWT sign/verify.
 * Pure functions: no Express types, testable in isolation.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserRole } from '../models/User';

const SALT_ROUNDS = 12;

// ─── Password ────────────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── Token payload ────────────────────────────────────────────────────────────

export interface TokenPayload {
  sub: string;       // userId
  email: string;
  role: UserRole;
  siteIds: string[];
  type: 'access' | 'refresh';
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<TokenPayload, 'type'>): string {
  const full: TokenPayload = { ...payload, type: 'access' };
  // Cast options as a whole: @types/jsonwebtoken v9 + exactOptionalPropertyTypes
  // reject an object literal whose expiresIn could be a plain string/undefined.
  const opts = { expiresIn: env.JWT_EXPIRY } as jwt.SignOptions;
  return jwt.sign(full, env.JWT_SECRET as jwt.Secret, opts);
}

export function signRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
  const full: TokenPayload = { ...payload, type: 'refresh' };
  const opts = { expiresIn: env.JWT_REFRESH_EXPIRY } as jwt.SignOptions;
  return jwt.sign(full, env.JWT_SECRET as jwt.Secret, opts);
}

// ─── Verify ───────────────────────────────────────────────────────────────────

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid token payload');
  }
  return decoded as TokenPayload;
}

/**
 * Verifies a refresh token and returns an access token.
 * Throws if the token is invalid or not a refresh type.
 */
export function refreshAccessToken(refreshToken: string): string {
  const payload = verifyToken(refreshToken);
  if (payload.type !== 'refresh') {
    throw new Error('Not a refresh token');
  }
  const { sub, email, role, siteIds } = payload;
  return signAccessToken({ sub, email, role, siteIds });
}
