/**
 * Subscription state helper.
 * Pure computation: given a Site document, derive the effective
 * subscription status and how many days remain.
 */
import type { ISite, SubscriptionStatus } from '../models/Site';

export interface SubscriptionState {
  /** Effective status after applying trial + grace window logic */
  status: SubscriptionStatus;
  /** Days remaining (positive = still time; negative or 0 = expired/overdue). null when active/suspended (no countdown). */
  daysLeft: number | null;
}

/**
 * Compute the effective subscription state from a Site.
 *
 * Rules:
 *  - 'active' or 'suspended' → pass through (platform decision).
 *  - 'trial' + no trialEndsAt → treat as ongoing trial; daysLeft = null.
 *  - 'trial' + trialEndsAt in future → trial, daysLeft = remaining days.
 *  - 'trial' + trialEndsAt passed but within graceDays → still 'trial' (grace), daysLeft = negative (days overdue).
 *  - 'trial' + trialEndsAt + grace exhausted → 'expired', daysLeft = 0.
 *  - 'expired' → pass through.
 */
export function getSubscriptionState(site: ISite): SubscriptionState {
  const { subscription, trialEndsAt, graceDays } = site;

  // Platform-managed statuses — pass through unchanged
  if (subscription === 'active') {
    return { status: 'active', daysLeft: null };
  }
  if (subscription === 'suspended') {
    return { status: 'suspended', daysLeft: null };
  }
  if (subscription === 'expired') {
    return { status: 'expired', daysLeft: 0 };
  }

  // 'trial' path
  if (!trialEndsAt) {
    // No end date set yet — treat as active trial, no countdown
    return { status: 'trial', daysLeft: null };
  }

  const now = Date.now();
  const trialEnd = trialEndsAt.getTime();
  const graceEnd = trialEnd + graceDays * 24 * 60 * 60 * 1000;

  if (now <= trialEnd) {
    // Still within trial window
    const daysLeft = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000));
    return { status: 'trial', daysLeft };
  }

  if (now <= graceEnd) {
    // Past trial but within grace period — still show as trial but with
    // daysLeft = 0 (at grace boundary) to trigger a strong warning.
    // We keep status 'trial' so the gate does not block yet.
    const daysLeft = Math.ceil((graceEnd - now) / (24 * 60 * 60 * 1000));
    return { status: 'trial', daysLeft };
  }

  // Both trial and grace have expired
  return { status: 'expired', daysLeft: 0 };
}
