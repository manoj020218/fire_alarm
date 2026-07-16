/**
 * ABC Towers seed — idempotent.
 * Inserts SITE001, gateway JNX-FG-XXXX, 5 role users, one FirmwareRelease.
 * Safe to run multiple times: upserts by natural keys, never duplicates.
 */
import mongoose from 'mongoose';
import { Site } from '../models/Site';
import { Gateway } from '../models/Gateway';
import { User, type UserRole } from '../models/User';
import { FirmwareRelease } from '../models/FirmwareRelease';
import { hashPassword } from '../services/auth.service';
import logger from '../config/logger';

const SITE_ID = 'SITE001';
const GATEWAY_ID = 'JNX-FG-XXXX';
// In production, rotate via /api/gateways/:id/token
const DEVICE_TOKEN = 'fg-device-token-abc-towers-2026';

const SEED_USERS: Array<{ email: string; role: UserRole; name: string; siteIds: string[] }> = [
  { email: 'admin@jenix.io',       role: 'JENIX_SUPER_ADMIN', name: 'Jenix Super Admin', siteIds: [] },
  { email: 'vendor@jenix.io',      role: 'VENDOR_ADMIN',       name: 'Jenix Vendor Admin', siteIds: [SITE_ID] },
  { email: 'admin@abctowers.com',  role: 'CLIENT_ADMIN',       name: 'ABC Client Admin', siteIds: [SITE_ID] },
  { email: 'maint@abctowers.com',  role: 'MAINTENANCE_USER',   name: 'ABC Maintenance', siteIds: [SITE_ID] },
  { email: 'viewer@abctowers.com', role: 'VIEWER',             name: 'ABC Viewer', siteIds: [SITE_ID] },
];

export async function seedAbcTowers(): Promise<void> {
  // ── Site ──────────────────────────────────────────────────────────────────
  await Site.findOneAndUpdate(
    { siteId: SITE_ID },
    {
      $setOnInsert: {
        siteId: SITE_ID,
        name: 'ABC Towers',
        address: 'Nariman Point, Mumbai, Maharashtra 400021',
        timezone: 'Asia/Kolkata',
        active: true,
        contactName: 'Rajesh Kumar',
        contactPhone: '+91 98765 43210',
      },
    },
    { upsert: true }
  );
  logger.info({ siteId: SITE_ID }, 'Site seeded');

  // ── Gateway ───────────────────────────────────────────────────────────────
  await Gateway.findOneAndUpdate(
    { gatewayId: GATEWAY_ID },
    {
      $setOnInsert: {
        gatewayId: GATEWAY_ID,
        siteId: SITE_ID,
        name: 'Pump Room Gateway',
        fw: '1.0.0',
        hw: 'vvm401',
        online: false,
        deviceToken: DEVICE_TOKEN,
      },
    },
    { upsert: true }
  );
  logger.info({ gatewayId: GATEWAY_ID }, 'Gateway seeded');

  // ── Users ─────────────────────────────────────────────────────────────────
  const passwordHash = await hashPassword('Pass@123');

  for (const u of SEED_USERS) {
    await User.findOneAndUpdate(
      { email: u.email },
      {
        $setOnInsert: {
          email: u.email,
          passwordHash,
          role: u.role,
          name: u.name,
          siteIds: u.siteIds,
          active: true,
        },
      },
      { upsert: true }
    );
  }
  logger.info('Users seeded');

  // ── FirmwareRelease ───────────────────────────────────────────────────────
  await FirmwareRelease.findOneAndUpdate(
    { hw: 'vvm401', version: '1.0.0' },
    {
      $setOnInsert: {
        hw: 'vvm401',
        version: '1.0.0',
        url: 'http://154.61.69.200:3001/api/fireguard/ota/binary/vvm401/1.0.0',
        sha256: 'a'.repeat(64), // placeholder — replace with real sha256 before deploy
        size: 1_048_576,
        mandatory: false,
        releasedAt: new Date('2026-07-01'),
        active: true,
        releaseNotes: 'Initial production release',
      },
    },
    { upsert: true }
  );
  logger.info('FirmwareRelease seeded');

  logger.info('ABC Towers seed complete');
}

// ── Standalone runner ─────────────────────────────────────────────────────────
// called by: pnpm seed   (via src/seed/run-seed.ts)
if (require.main === module) {
  const uri = process.env['MONGODB_URI'];
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  mongoose
    .connect(uri)
    .then(() => seedAbcTowers())
    .then(() => mongoose.disconnect())
    .catch((err: unknown) => {
      console.error('Seed failed', err);
      process.exit(1);
    });
}
