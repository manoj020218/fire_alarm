/**
 * RBAC role-guard middleware.
 * Usage: router.get('/admin', authenticate, requireRole('CLIENT_ADMIN'), handler)
 *   — passes if the caller's role is >= the required role in the hierarchy.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ROLE_HIERARCHY, type UserRole } from '../models/User';
import { AppError } from '../utils/AppError';

/**
 * Returns true if the caller's role is at least as privileged as `required`.
 */
export function hasAtLeastRole(callerRole: UserRole, required: UserRole): boolean {
  return ROLE_HIERARCHY[callerRole] >= ROLE_HIERARCHY[required];
}

/**
 * Middleware factory.
 * Requires `authenticate` to run before this (req.user must be set).
 */
export function requireRole(minimum: UserRole): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }
    if (!hasAtLeastRole(req.user.role, minimum)) {
      return next(
        AppError.forbidden(
          `Role ${req.user.role} does not have permission. Required: ${minimum} or higher.`
        )
      );
    }
    next();
  };
}
