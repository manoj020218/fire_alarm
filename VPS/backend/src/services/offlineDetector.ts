/**
 * Gateway offline detector.
 * Runs every 30 s; marks Gateway.online = false when lastSeenAt is older than 2 minutes.
 * Broadcasts the status change via Socket.IO.
 * Never throws — all errors are logged.
 */
import { Gateway } from '../models/Gateway';
import { emitGatewayStatus } from '../socket/socketServer';
import logger from '../config/logger';

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const CHECK_INTERVAL_MS = 30_000;            // 30 seconds

let intervalId: ReturnType<typeof setInterval> | null = null;

export async function runOfflineCheck(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    // Find all gateways that are marked online but haven't been seen since cutoff
    const stale = await Gateway.find({
      online: true,
      lastSeenAt: { $lt: cutoff },
    }).lean();

    if (stale.length === 0) return;

    // Bulk mark offline
    const ids = stale.map((g) => g.gatewayId);
    await Gateway.updateMany(
      { gatewayId: { $in: ids } },
      { $set: { online: false } }
    );

    // Broadcast per gateway
    for (const gw of stale) {
      logger.warn({ gatewayId: gw.gatewayId, siteId: gw.siteId }, 'Gateway marked offline');
      emitGatewayStatus(gw.siteId, {
        gatewayId: gw.gatewayId,
        siteId: gw.siteId,
        online: false,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.error({ err }, 'Offline detector error');
  }
}

/** Start the periodic offline check. Idempotent. */
export function startOfflineDetector(): void {
  if (intervalId !== null) return;
  intervalId = setInterval(() => { void runOfflineCheck(); }, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, 'Gateway offline detector started');
}

/** Stop the periodic offline check. */
export function stopOfflineDetector(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Gateway offline detector stopped');
  }
}
