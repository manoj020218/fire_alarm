/**
 * Unit tests for auth service — hash/compare/sign/verify/refresh.
 * No DB needed; pure crypto functions.
 */
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyToken,
  refreshAccessToken,
} from '../../../src/services/auth.service';

// env is loaded via globalSetup (sets JWT_SECRET etc.)

describe('auth.service', () => {
  // ── Password ────────────────────────────────────────────────────────────────

  describe('hashPassword', () => {
    it('returns a bcrypt hash', async () => {
      const hash = await hashPassword('Pass@123');
      expect(hash).toMatch(/^\$2[ab]\$\d+\$/);
    });

    it('different calls produce different salts', async () => {
      const h1 = await hashPassword('Pass@123');
      const h2 = await hashPassword('Pass@123');
      expect(h1).not.toBe(h2);
    });
  });

  describe('comparePassword', () => {
    it('returns true for correct password', async () => {
      const hash = await hashPassword('Pass@123');
      expect(await comparePassword('Pass@123', hash)).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const hash = await hashPassword('Pass@123');
      expect(await comparePassword('WrongPass', hash)).toBe(false);
    });

    it('returns false for empty password', async () => {
      const hash = await hashPassword('Pass@123');
      expect(await comparePassword('', hash)).toBe(false);
    });
  });

  // ── Token ────────────────────────────────────────────────────────────────────

  const basePayload = {
    sub: 'user-id-123',
    email: 'admin@jenix.io',
    role: 'JENIX_SUPER_ADMIN' as const,
    siteIds: ['SITE001'],
  };

  describe('signAccessToken / verifyToken', () => {
    it('signs and verifies an access token', () => {
      const token = signAccessToken(basePayload);
      expect(typeof token).toBe('string');

      const decoded = verifyToken(token);
      expect(decoded.sub).toBe(basePayload.sub);
      expect(decoded.email).toBe(basePayload.email);
      expect(decoded.role).toBe(basePayload.role);
      expect(decoded.siteIds).toEqual(basePayload.siteIds);
      expect(decoded.type).toBe('access');
    });

    it('rejects a tampered token', () => {
      const token = signAccessToken(basePayload);
      const tampered = token.slice(0, -4) + 'xxxx';
      expect(() => verifyToken(tampered)).toThrow();
    });
  });

  describe('signRefreshToken / verifyToken', () => {
    it('signs a refresh token with type=refresh', () => {
      const token = signRefreshToken(basePayload);
      const decoded = verifyToken(token);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('refreshAccessToken', () => {
    it('issues a new access token from a valid refresh token', () => {
      const refresh = signRefreshToken(basePayload);
      const access = refreshAccessToken(refresh);
      const decoded = verifyToken(access);
      expect(decoded.type).toBe('access');
      expect(decoded.sub).toBe(basePayload.sub);
    });

    it('throws when given an access token instead of refresh', () => {
      const access = signAccessToken(basePayload);
      expect(() => refreshAccessToken(access)).toThrow('Not a refresh token');
    });

    it('throws for an invalid token', () => {
      expect(() => refreshAccessToken('bad.token.here')).toThrow();
    });
  });
});
