/**
 * Tenant-scoping helper.
 *
 * SUPER_ADMIN and VENDOR_ADMIN see all sites.
 * All other roles are constrained to the siteIds on their User document.
 *
 * Usage in a service:
 *   const filter = scopeFilter(req.user, { active: true });
 *   const sites = await Site.find(filter);
 */
import type { FilterQuery } from 'mongoose';
import { ROLE_HIERARCHY, type UserRole } from '../models/User';

/** Minimal shape of the caller extracted from JWT */
export interface CallerContext {
  role: UserRole;
  siteIds: string[];
}

/**
 * Returns a Mongoose filter that adds `{ siteId: { $in: [...] } }` unless
 * the caller has super-level access (JENIX_SUPER_ADMIN or VENDOR_ADMIN).
 */
export function scopeFilter<T extends object>(
  caller: CallerContext,
  base: FilterQuery<T> = {},
  // Field holding the site reference on the target model. Most models use a
  // single `siteId`; the User model uses a `siteIds` array (both work with $in).
  siteField: string = 'siteId'
): FilterQuery<T> {
  const superRoles: UserRole[] = ['JENIX_SUPER_ADMIN', 'VENDOR_ADMIN'];
  if (superRoles.includes(caller.role)) {
    return base;
  }
  return { ...base, [siteField]: { $in: caller.siteIds } } as FilterQuery<T>;
}

/**
 * Returns true if the caller can access the given siteId.
 */
export function canAccessSite(caller: CallerContext, siteId: string): boolean {
  if (ROLE_HIERARCHY[caller.role] >= ROLE_HIERARCHY['VENDOR_ADMIN']) {
    return true;
  }
  return caller.siteIds.includes(siteId);
}
