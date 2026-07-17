/**
 * Bridge authentication middleware.
 * Validates the X-Bridge-Secret header against the BRIDGE_SECRET env var
 * using crypto.timingSafeEqual to prevent timing-based secret discovery.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

function safeCompare(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

export const bridgeAuth: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const provided = req.headers['x-bridge-secret'];
  if (typeof provided !== 'string' || !provided) {
    next(AppError.unauthorized('Missing X-Bridge-Secret header'));
    return;
  }
  if (!safeCompare(provided, env.BRIDGE_SECRET)) {
    next(AppError.unauthorized('Invalid X-Bridge-Secret'));
    return;
  }
  next();
};
