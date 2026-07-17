/**
 * Bridge controller — provision endpoint called by the billing platform.
 *
 * POST /api/bridge/provision
 *   Creates a Site + CLIENT_ADMIN User for a new organisation.
 *   Returns a one-time temp password in plaintext (never stored plaintext).
 *   409 if adminEmail already exists.
 */
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { Site } from '../models/Site';
import { User } from '../models/User';
import { hashPassword } from '../services/auth.service';
import { writeAudit } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { env } from '../config/env';
import type { ProvisionBody } from '../validation/bridge.schema';

/** Generate a random siteId of the form SITE-XXXXXX (6 uppercase hex chars). */
function generateSiteId(): string {
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars
  return `SITE-${hex}`;
}

/** Generate a random temporary password (20 chars, URL-safe). */
function generateTempPassword(): string {
  // 15 bytes → 20 base64url chars, no padding issues
  return crypto.randomBytes(15).toString('base64url');
}

// ── POST /api/bridge/provision ────────────────────────────────────────────────

export const provision = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { orgName, adminName, adminEmail, phone, trialEndsAt } = req.body as ProvisionBody;

  const normalizedEmail = adminEmail.toLowerCase().trim();

  // 409 if the adminEmail is already in use
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw AppError.conflict(`A user with email ${normalizedEmail} already exists`);
  }

  // Generate a unique siteId (retry once on the rare collision)
  let siteId = generateSiteId();
  let siteExists = await Site.findOne({ siteId });
  if (siteExists) {
    siteId = generateSiteId();
    siteExists = await Site.findOne({ siteId });
    if (siteExists) {
      // Still colliding — extremely unlikely with 16M possibilities
      throw AppError.internal('Failed to generate a unique siteId — please retry');
    }
  }

  const trialEndsAtDate = new Date(trialEndsAt);

  // Create the Site
  const site = await Site.create({
    siteId,
    name: orgName,
    address: phone ? `Contact: ${phone}` : 'Provisioned via billing platform',
    timezone: 'Asia/Kolkata',
    active: true,
    subscription: 'trial',
    trialEndsAt: trialEndsAtDate,
    graceDays: 15,
  });

  // Generate + hash a random temp password
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  // Create the CLIENT_ADMIN user
  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    role: 'CLIENT_ADMIN',
    name: adminName,
    siteIds: [siteId],
    active: true,
  });

  // Audit the provisioning event
  await writeAudit({
    action: 'CREATE',
    entity: 'Site',
    entityId: siteId,
    after: {
      siteId,
      orgName,
      adminEmail: normalizedEmail,
      adminUserId: String(user._id),
      source: 'bridge/provision',
    },
    actorOverride: 'BILLING_PLATFORM',
    actorEmailOverride: 'billing@iotsoft.in',
  });

  res.status(200).json({
    ok: true,
    siteId,
    adminEmail: normalizedEmail,
    tempPassword,
    loginUrl: env.APP_LOGIN_URL,
  });
});
