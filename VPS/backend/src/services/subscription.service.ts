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
  /** false = trial not yet started (no gateway activated). true once counting or on a paid/expired plan. */
  trialStarted: boolean;
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
    return { status: 'active', daysLeft: null, trialStarted: true };
  }
  if (subscription === 'suspended') {
    return { status: 'suspended', daysLeft: null, trialStarted: true };
  }
  if (subscription === 'expired') {
    return { status: 'expired', daysLeft: 0, trialStarted: true };
  }

  // 'trial' path
  if (!trialEndsAt) {
    // Trial has not started yet — no gateway activated. No countdown, no block.
    return { status: 'trial', daysLeft: null, trialStarted: false };
  }

  const now = Date.now();
  const trialEnd = trialEndsAt.getTime();
  const graceEnd = trialEnd + graceDays * 24 * 60 * 60 * 1000;

  if (now <= trialEnd) {
    // Still within trial window
    const daysLeft = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000));
    return { status: 'trial', daysLeft, trialStarted: true };
  }

  if (now <= graceEnd) {
    // Past trial but within grace period — still show as trial but with
    // daysLeft = 0 (at grace boundary) to trigger a strong warning.
    // We keep status 'trial' so the gate does not block yet.
    const daysLeft = Math.ceil((graceEnd - now) / (24 * 60 * 60 * 1000));
    return { status: 'trial', daysLeft, trialStarted: true };
  }

  // Both trial and grace have expired
  return { status: 'expired', daysLeft: 0, trialStarted: true };
}
