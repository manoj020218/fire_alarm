/**
 * Device authentication middleware.
 * Verifies X-Gateway-Id + X-Gateway-Token against Gateway.deviceToken.
 * Uses timingSafeEqual to prevent timing attacks.
 * Attaches req.gateway to the request on success.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { timingSafeEqual } from 'crypto';
import { Gateway, type IGatewayDocument } from '../models/Gateway';
import { AppError } from '../utils/AppError';

// Augment Express Request so req.gateway is typed everywhere
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      gateway?: IGatewayDocument;
    }
  }
}

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

// Cast to RequestHandler; the async function is compatible at runtime
export const deviceAuth = (async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const gatewayId = req.headers['x-gateway-id'];
  const gatewayToken = req.headers['x-gateway-token'];

  if (typeof gatewayId !== 'string' || !gatewayId || typeof gatewayToken !== 'string' || !gatewayToken) {
    next(AppError.unauthorized('Missing X-Gateway-Id or X-Gateway-Token'));
    return;
  }

  try {
    // Must select +deviceToken since it is excluded by default
    const gateway = await Gateway.findOne({ gatewayId: gatewayId.toUpperCase() }).select('+deviceToken');
    if (!gateway) {
      next(AppError.unauthorized('Unknown gateway'));
      return;
    }

    if (!safeCompare(gatewayToken, gateway.deviceToken)) {
      next(AppError.unauthorized('Invalid gateway token'));
      return;
    }

    req.gateway = gateway;
    next();
  } catch (err) {
    next(err);
  }
}) as RequestHandler;
