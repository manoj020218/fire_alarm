/**
 * JWT authentication middleware.
 * Extracts Bearer token, verifies it, attaches decoded payload to req.user.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken, type TokenPayload } from '../services/auth.service';
import { AppError } from '../utils/AppError';

// Augment Express Request so req.user is typed everywhere
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authenticate: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing or malformed Authorization header'));
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    if (payload.type !== 'access') {
      return next(AppError.unauthorized('Token is not an access token'));
    }
    req.user = payload;
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
  }
};
