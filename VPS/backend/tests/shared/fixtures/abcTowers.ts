/**
 * ABC Towers, Mumbai — seed data for all tests.
 * Matches CLAUDE.md §6 seed users. Passwords are hashed at test setup time.
 */
import type { IUser } from '../../../src/models/User';
import type { ISite } from '../../../src/models/Site';
import type { IGateway } from '../../../src/models/Gateway';
import type { IAlarm } from '../../../src/models/Alarm';

// ─── Site ─────────────────────────────────────────────────────────────────────

export const SITE_ABC: Omit<ISite, never> = {
  siteId: 'SITE001',
  name: 'ABC Towers',
  address: 'Nariman Point, Mumbai, Maharashtra 400021',
  timezone: 'Asia/Kolkata',
  active: true,
  contactName: 'Rajesh Kumar',
  contactPhone: '+91 98765 43210',
  // Subscription defaults (all tests that use this fixture get a valid trial site)
  subscription: 'trial',
  graceDays: 15,
};

// ─── Gateway ──────────────────────────────────────────────────────────────────

export const GATEWAY_ABC: Omit<IGateway, never> = {
  gatewayId: 'JNX-FG-AB12',
  siteId: 'SITE001',
  name: 'Pump Room Gateway',
  fw: '1.0.0',
  hw: 'vvm401',
  online: true,
  uplink: 'wifi',
  deviceToken: 'test-device-token-abc12', // tests override this
  rssi: -62,
};

// ─── Users ────────────────────────────────────────────────────────────────────
// passwordHash is set by the test setup (bcrypt hash of 'Pass@123')
// We use a plain-text sentinel here; fixtures.ts sets the real hash.

export const USERS_RAW: Array<Omit<IUser, 'passwordHash'> & { password: string }> = [
  {
    email: 'admin@jenix.io',
    password: 'Pass@123',
    role: 'JENIX_SUPER_ADMIN',
    name: 'Jenix Super Admin',
    siteIds: [],
    active: true,
  },
  {
    email: 'vendor@jenix.io',
    password: 'Pass@123',
    role: 'VENDOR_ADMIN',
    name: 'Jenix Vendor Admin',
    siteIds: ['SITE001'],
    active: true,
  },
  {
    email: 'admin@abctowers.com',
    password: 'Pass@123',
    role: 'CLIENT_ADMIN',
    name: 'ABC Client Admin',
    siteIds: ['SITE001'],
    active: true,
  },
  {
    email: 'maint@abctowers.com',
    password: 'Pass@123',
    role: 'MAINTENANCE_USER',
    name: 'ABC Maintenance',
    siteIds: ['SITE001'],
    active: true,
  },
  {
    email: 'viewer@abctowers.com',
    password: 'Pass@123',
    role: 'VIEWER',
    name: 'ABC Viewer',
    siteIds: ['SITE001'],
    active: true,
  },
];

// ─── Sample alarm ─────────────────────────────────────────────────────────────

export const ALARM_LOW_PRESSURE: Omit<IAlarm, never> = {
  alarmId: 'ALM-TEST-001',
  siteId: 'SITE001',
  gatewayId: 'JNX-FG-AB12',
  deviceId: 'sprinklerPressure',
  parameter: 'sprinkler_pressure_low',
  value: 1.2,
  severity: 'warning',
  timestamp: new Date('2026-07-10T10:00:00Z'),
  active: true,
  acknowledged: false,
  source: 'mqtt',
};
