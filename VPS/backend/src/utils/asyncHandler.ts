/**
 * Wraps an async Express route handler so thrown errors are forwarded to next().
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncFn): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
