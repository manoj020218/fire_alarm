/**
 * Device HTTP contract controller.
 * Handles telemetry ingest, alarm ingest, OTA backup, manifest, and binary.
 * All endpoints require deviceAuth middleware (X-Gateway-Id + X-Gateway-Token).
 */
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { handleTelemetry, handleAlarm } from '../mqtt/mqttHandlers';
import { GatewayBackup } from '../models/GatewayBackup';
import { FirmwareRelease } from '../models/FirmwareRelease';
import { mqttConfig } from '../config/mqtt';
import logger from '../config/logger';
import type { OtaManifestQuery, OtaBinaryParams } from '../validation/device.schema';

// ─── Helper: semver compare ───────────────────────────────────────────────────

function parseSemver(v: string): [number, number, number] {
  const parts = v.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isNewer(candidate: string, current: string): boolean {
  const [ca, cb, cc] = parseSemver(candidate);
  const [a, b, c] = parseSemver(current);
  if (ca !== a) return ca > a;
  if (cb !== b) return cb > b;
  return cc > c;
}

function meetsMinFrom(currentFw: string, minFrom: string | undefined): boolean {
  if (!minFrom) return true;
  // currentFw must be >= minFrom
  const [ca, cb, cc] = parseSemver(currentFw);
  const [a, b, c] = parseSemver(minFrom);
  if (ca !== a) return ca > a;
  if (cb !== b) return cb > b;
  return cc >= c;
}

// ─── POST /api/fireguard/ingest ───────────────────────────────────────────────

export const deviceIngest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.gateway) throw AppError.unauthorized();
  // Re-use the MQTT telemetry handler (source = 'http')
  const payload = Buffer.from(JSON.stringify(req.body));
  await handleTelemetry(payload, 'http');
  res.json({ ok: true });
});

// ─── POST /api/fireguard/alarm ────────────────────────────────────────────────

export const deviceAlarm = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.gateway) throw AppError.unauthorized();
  const payload = Buffer.from(JSON.stringify(req.body));
  await handleAlarm(payload, 'http');
  res.json({ ok: true });
});

// ─── POST /api/fireguard/backup ───────────────────────────────────────────────

export const deviceBackup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.gateway) throw AppError.unauthorized();

  const { gatewayId, fwVersion, ts, config, alarmState, undelivered, health } =
    req.body as {
      gatewayId: string;
      fwVersion: string;
      ts: number;
      config: unknown;
      alarmState: unknown;
      undelivered: unknown;
      health: unknown;
    };

  const backup = await GatewayBackup.create({
    backupId: randomUUID(),
    gatewayId,
    siteId: req.gateway.siteId,
    fwVersion,
    ts: new Date(ts * 1000),
    config,
    alarmState,
    undelivered,
    health,
  });

  logger.info({ backupId: backup.backupId, gatewayId }, 'Gateway backup stored');
  res.json({ ok: true, backupId: backup.backupId });
});

// ─── GET /api/fireguard/ota/manifest ─────────────────────────────────────────

export const otaManifest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.gateway) throw AppError.unauthorized();

  const query = req.query as unknown as OtaManifestQuery;
  const { fw: currentFw, hw } = query;

  // Latest active release for this hw target
  const release = await FirmwareRelease.findOne({ hw, active: true })
    .sort({ releasedAt: -1 })
    .lean();

  if (!release) {
    res.status(204).end();
    return;
  }

  // Already up to date?
  if (!isNewer(release.version, currentFw)) {
    res.status(204).end();
    return;
  }

  // minFrom check: warn but still return manifest (device handles blocking if it can't apply)
  if (!meetsMinFrom(currentFw, release.minFrom)) {
    logger.warn(
      { gatewayId: req.gateway.gatewayId, currentFw, minFrom: release.minFrom },
      'Device fw below minFrom; returning manifest anyway'
    );
  }

  res.json({
    version: release.version,
    url: release.url,
    sha256: release.sha256,
    size: release.size,
    mandatory: release.mandatory,
    minFrom: release.minFrom ?? null,
  });
});

// ─── GET /api/fireguard/ota/binary/:hw/:version ───────────────────────────────

export const otaBinary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.gateway) throw AppError.unauthorized();

  const { hw, version } = req.params as unknown as OtaBinaryParams;

  const release = await FirmwareRelease.findOne({ hw, version, active: true }).lean();
  if (!release) {
    throw AppError.notFound(`Firmware ${hw}@${version}`);
  }

  const storageDir = mqttConfig.OTA_STORAGE_DIR;
  const binPath = path.resolve(storageDir, hw, `${version}.bin`);

  if (!fs.existsSync(binPath)) {
    logger.warn({ binPath }, 'OTA binary file not found on disk');
    throw AppError.notFound('Firmware binary');
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Firmware-SHA256', release.sha256);
  res.setHeader('X-Firmware-Version', version);
  res.download(binPath, `${hw}-${version}.bin`);
});
