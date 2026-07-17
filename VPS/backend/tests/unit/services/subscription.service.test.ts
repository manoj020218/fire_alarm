/**
 * Unit tests for subscription.service — getSubscriptionState().
 * Pure function: no DB, no network.
 */
import { getSubscriptionState } from '../../../src/services/subscription.service';
import type { ISite } from '../../../src/models/Site';

// A minimal ISite stub — only the fields getSubscriptionState reads
function makeSite(overrides: Partial<ISite> = {}): ISite {
  return {
    siteId: 'SITE-TEST',
    name: 'Test Site',
    address: 'Test Address',
    timezone: 'Asia/Kolkata',
    active: true,
    subscription: 'trial',
    graceDays: 15,
    ...overrides,
  };
}

const DAY = 24 * 60 * 60 * 1000;

describe('getSubscriptionState', () => {
  // ── Platform-managed statuses ─────────────────────────────────────────────

  it('returns { status: active, daysLeft: null } for active subscription', () => {
    const state = getSubscriptionState(makeSite({ subscription: 'active' }));
    expect(state.status).toBe('active');
    expect(state.daysLeft).toBeNull();
  });

  it('returns { status: suspended, daysLeft: null } for suspended subscription', () => {
    const state = getSubscriptionState(makeSite({ subscription: 'suspended' }));
    expect(state.status).toBe('suspended');
    expect(state.daysLeft).toBeNull();
  });

  it('returns { status: expired, daysLeft: 0 } for explicitly expired subscription', () => {
    const state = getSubscriptionState(makeSite({ subscription: 'expired' }));
    expect(state.status).toBe('expired');
    expect(state.daysLeft).toBe(0);
  });

  // ── Trial — no end date ───────────────────────────────────────────────────

  it('returns { status: trial, daysLeft: null } when trialEndsAt is not set', () => {
    const state = getSubscriptionState(makeSite({ subscription: 'trial', trialEndsAt: undefined }));
    expect(state.status).toBe('trial');
    expect(state.daysLeft).toBeNull();
  });

  // ── Trial — active window ─────────────────────────────────────────────────

  it('returns trial + positive daysLeft when trial ends in the future', () => {
    const trialEndsAt = new Date(Date.now() + 30 * DAY);
    const state = getSubscriptionState(makeSite({ trialEndsAt }));
    expect(state.status).toBe('trial');
    expect(state.daysLeft).toBeGreaterThan(0);
    expect(state.daysLeft).toBeLessThanOrEqual(30);
  });

  it('daysLeft is ceil (rounds up partial days)', () => {
    // trialEndsAt = 12 hours from now → daysLeft should be 1
    const trialEndsAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const state = getSubscriptionState(makeSite({ trialEndsAt }));
    expect(state.status).toBe('trial');
    expect(state.daysLeft).toBe(1);
  });

  // ── Trial — inside grace window ───────────────────────────────────────────

  it('stays trial during grace period (past trialEndsAt but within graceDays)', () => {
    // trial ended 5 days ago, grace = 15 days → still within grace
    const trialEndsAt = new Date(Date.now() - 5 * DAY);
    const state = getSubscriptionState(makeSite({ trialEndsAt, graceDays: 15 }));
    expect(state.status).toBe('trial');
    // daysLeft: (graceEnd - now) → ~10 days remaining in grace
    expect(state.daysLeft).toBeGreaterThan(0);
    expect(state.daysLeft).toBeLessThanOrEqual(10);
  });

  it('stays trial on the last day of grace (boundary)', () => {
    // trial ended exactly graceDays ago → grace just ended, should be expired
    // But trial ended (graceDays - 1) days ago → 1 day of grace left
    const trialEndsAt = new Date(Date.now() - 14 * DAY);
    const state = getSubscriptionState(makeSite({ trialEndsAt, graceDays: 15 }));
    expect(state.status).toBe('trial');
  });

  // ── Trial — grace expired ─────────────────────────────────────────────────

  it('returns expired once trial + grace have both elapsed', () => {
    // trial ended 30 days ago, grace = 15 days → 15 days past grace
    const trialEndsAt = new Date(Date.now() - 30 * DAY);
    const state = getSubscriptionState(makeSite({ trialEndsAt, graceDays: 15 }));
    expect(state.status).toBe('expired');
    expect(state.daysLeft).toBe(0);
  });

  it('returns expired immediately after grace window closes', () => {
    // trial ended (graceDays + 1) days ago
    const trialEndsAt = new Date(Date.now() - 16 * DAY);
    const state = getSubscriptionState(makeSite({ trialEndsAt, graceDays: 15 }));
    expect(state.status).toBe('expired');
    expect(state.daysLeft).toBe(0);
  });

  it('expired with graceDays = 0 fires immediately after trial end', () => {
    const trialEndsAt = new Date(Date.now() - 1 * DAY);
    const state = getSubscriptionState(makeSite({ trialEndsAt, graceDays: 0 }));
    expect(state.status).toBe('expired');
  });

  // ── Active overrides trial date logic ─────────────────────────────────────

  it('active subscription with a past trialEndsAt is still active', () => {
    const trialEndsAt = new Date(Date.now() - 60 * DAY);
    const state = getSubscriptionState(makeSite({ subscription: 'active', trialEndsAt }));
    expect(state.status).toBe('active');
    expect(state.daysLeft).toBeNull();
  });
});
