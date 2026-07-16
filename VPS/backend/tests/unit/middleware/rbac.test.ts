/**
 * Unit tests for RBAC — role ordering and guard middleware.
 */
import { hasAtLeastRole, requireRole } from '../../../src/middleware/rbac.middleware';
import { ROLE_HIERARCHY, type UserRole } from '../../../src/models/User';
import type { Request, Response, NextFunction } from 'express';
import type { TokenPayload } from '../../../src/services/auth.service';

// ── Role hierarchy ─────────────────────────────────────────────────────────────

describe('ROLE_HIERARCHY', () => {
  it('JENIX_SUPER_ADMIN has highest value', () => {
    const levels = Object.values(ROLE_HIERARCHY);
    expect(ROLE_HIERARCHY['JENIX_SUPER_ADMIN']).toBe(Math.max(...levels));
  });

  it('VIEWER has lowest value', () => {
    const levels = Object.values(ROLE_HIERARCHY);
    expect(ROLE_HIERARCHY['VIEWER']).toBe(Math.min(...levels));
  });

  it('ordering: SUPER > VENDOR > CLIENT > MAINTENANCE > VIEWER', () => {
    const ordered: UserRole[] = [
      'JENIX_SUPER_ADMIN',
      'VENDOR_ADMIN',
      'CLIENT_ADMIN',
      'MAINTENANCE_USER',
      'VIEWER',
    ];
    for (let i = 0; i < ordered.length - 1; i++) {
      const current = ordered[i] as UserRole;
      const next = ordered[i + 1] as UserRole;
      expect(ROLE_HIERARCHY[current]).toBeGreaterThan(ROLE_HIERARCHY[next]);
    }
  });
});

// ── hasAtLeastRole ─────────────────────────────────────────────────────────────

describe('hasAtLeastRole', () => {
  it('JENIX_SUPER_ADMIN passes every requirement', () => {
    const roles: UserRole[] = [
      'JENIX_SUPER_ADMIN', 'VENDOR_ADMIN', 'CLIENT_ADMIN', 'MAINTENANCE_USER', 'VIEWER',
    ];
    for (const req of roles) {
      expect(hasAtLeastRole('JENIX_SUPER_ADMIN', req)).toBe(true);
    }
  });

  it('VIEWER only passes VIEWER requirement', () => {
    expect(hasAtLeastRole('VIEWER', 'VIEWER')).toBe(true);
    expect(hasAtLeastRole('VIEWER', 'MAINTENANCE_USER')).toBe(false);
    expect(hasAtLeastRole('VIEWER', 'CLIENT_ADMIN')).toBe(false);
  });

  it('MAINTENANCE_USER passes MAINTENANCE_USER and VIEWER', () => {
    expect(hasAtLeastRole('MAINTENANCE_USER', 'MAINTENANCE_USER')).toBe(true);
    expect(hasAtLeastRole('MAINTENANCE_USER', 'VIEWER')).toBe(true);
    expect(hasAtLeastRole('MAINTENANCE_USER', 'CLIENT_ADMIN')).toBe(false);
  });

  it('CLIENT_ADMIN cannot reach VENDOR_ADMIN or higher', () => {
    expect(hasAtLeastRole('CLIENT_ADMIN', 'VENDOR_ADMIN')).toBe(false);
    expect(hasAtLeastRole('CLIENT_ADMIN', 'JENIX_SUPER_ADMIN')).toBe(false);
  });
});

// ── requireRole middleware ─────────────────────────────────────────────────────

function makeReq(user?: TokenPayload): Partial<Request> {
  return { user } as Partial<Request>;
}

describe('requireRole middleware', () => {
  let next: jest.MockedFunction<NextFunction>;
  let res: Partial<Response>;

  beforeEach(() => {
    next = jest.fn() as jest.MockedFunction<NextFunction>;
    res = {} as Partial<Response>;
  });

  it('calls next() when role is sufficient', () => {
    const user: TokenPayload = {
      sub: '1', email: 'a@b.com', role: 'CLIENT_ADMIN', siteIds: [], type: 'access',
    };
    const mw = requireRole('VIEWER');
    mw(makeReq(user) as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(); // no args = success
  });

  it('calls next(AppError 403) when role is too low', () => {
    const user: TokenPayload = {
      sub: '1', email: 'v@b.com', role: 'VIEWER', siteIds: [], type: 'access',
    };
    const mw = requireRole('CLIENT_ADMIN');
    mw(makeReq(user) as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    const arg = next.mock.calls[0]?.[0] as unknown as { statusCode: number };
    expect(arg.statusCode).toBe(403);
  });

  it('calls next(AppError 401) when req.user is undefined', () => {
    const mw = requireRole('VIEWER');
    mw(makeReq(undefined) as Request, res as Response, next);
    const arg = next.mock.calls[0]?.[0] as unknown as { statusCode: number };
    expect(arg.statusCode).toBe(401);
  });

  it('JENIX_SUPER_ADMIN passes a JENIX_SUPER_ADMIN gate', () => {
    const user: TokenPayload = {
      sub: '1', email: 's@b.com', role: 'JENIX_SUPER_ADMIN', siteIds: [], type: 'access',
    };
    const mw = requireRole('JENIX_SUPER_ADMIN');
    mw(makeReq(user) as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
