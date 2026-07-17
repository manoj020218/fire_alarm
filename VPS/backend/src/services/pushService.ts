/**
 * pushService — FCM push via firebase-admin (HTTP v1).
 *
 * Initialises lazily from a Firebase service-account JSON whose path is given by
 * env.FIREBASE_SERVICE_ACCOUNT_FILE. If that is not configured the service runs
 * in a disabled no-op mode (the rest of the app is unaffected), so the backend
 * boots fine before the service account is provisioned.
 */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps, type App, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../config/env';
import logger from '../config/logger';
import { PushToken, type PushPlatform } from '../models/PushToken';
import { User } from '../models/User';
import type { IAlarmDocument } from '../models/Alarm';

let app: App | null = null;
let initTried = false;

function getApp(): App | null {
  if (initTried) return app;
  initTried = true;

  const path = env.FIREBASE_SERVICE_ACCOUNT_FILE;
  if (!path) {
    logger.warn('FCM disabled: FIREBASE_SERVICE_ACCOUNT_FILE not set (push notifications will not be sent)');
    return null;
  }
  try {
    const serviceAccount = JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount;
    app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
    logger.info('FCM initialised (firebase-admin)');
  } catch (err) {
    logger.error({ err }, 'FCM init failed — push notifications disabled');
    app = null;
  }
  return app;
}

/** True when a service account is configured and firebase-admin initialised. */
export function isPushEnabled(): boolean {
  return getApp() !== null;
}

/** Upsert (re-own) a device token for a user. */
export async function registerToken(
  userId: string,
  siteIds: string[],
  token: string,
  platform: PushPlatform
): Promise<void> {
  await PushToken.findOneAndUpdate(
    { token },
    { $set: { userId, siteIds, platform, lastSeenAt: new Date() } },
    { upsert: true }
  );
}

/** Remove a token (on logout / unregister). */
export async function removeToken(token: string): Promise<void> {
  await PushToken.deleteOne({ token });
}

/**
 * Send an alarm push to every user who can see the alarm's site.
 * Fire-and-forget from the caller; never throws.
 */
export async function sendAlarmPush(alarm: IAlarmDocument): Promise<void> {
  const fb = getApp();
  if (!fb) return;

  try {
    // Users who can see this site (super/vendor admins see all; others by siteIds)
    const users = await User.find({
      active: true,
      $or: [
        { siteIds: alarm.siteId },
        { role: { $in: ['JENIX_SUPER_ADMIN', 'VENDOR_ADMIN'] } },
      ],
    }).select('_id');
    if (users.length === 0) return;

    const userIds = users.map((u) => String(u._id));
    const tokenDocs = await PushToken.find({ userId: { $in: userIds } }).select('token');
    const tokens = tokenDocs.map((t) => t.token);
    if (tokens.length === 0) return;

    const title =
      alarm.severity === 'critical' ? '🚨 Critical alarm' : '⚠️ Warning';
    const body = `${prettifyParam(alarm.parameter)} — ${String(alarm.value)} (${alarm.deviceId})`;

    // sendEachForMulticast handles up to 500 tokens per call
    const res = await getMessaging(fb).sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: {
        type: 'alarm',
        alarmId: alarm.alarmId,
        siteId: alarm.siteId,
        severity: alarm.severity,
        deviceId: alarm.deviceId,
      },
      android: { priority: 'high', notification: { channelId: 'fireguard_alarms', sound: 'default' } },
    });

    // Prune tokens FCM reports as permanently invalid
    const stale: string[] = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code;
      const tk = tokens[i];
      if (
        tk &&
        (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-argument' ||
          code === 'messaging/invalid-registration-token')
      ) {
        stale.push(tk);
      }
    });
    if (stale.length) await PushToken.deleteMany({ token: { $in: stale } });

    logger.info(
      { alarmId: alarm.alarmId, sent: res.successCount, failed: res.failureCount, pruned: stale.length },
      'FCM alarm push sent'
    );
  } catch (err) {
    logger.error({ err, alarmId: alarm.alarmId }, 'FCM alarm push failed');
  }
}

function prettifyParam(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
