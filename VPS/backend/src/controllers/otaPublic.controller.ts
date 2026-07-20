/**
 * Public OTA endpoints — NO device auth.
 *
 * OTA firmware is the same signed image for every gateway of a given hw target,
 * and integrity is guaranteed by the SHA-256 the device verifies after download.
 * So these are served without a per-device token, over plain HTTP, which is what
 * the ESP32/4G bootloader can fetch reliably.
 *
 *   GET /api/fireguard/ota/manifest?gw=&fw=&hw=
 *   GET /api/fireguard/ota/download/:hw/:version
 */
import path from 'path';
import fs from 'fs';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { FirmwareRelease } from '../models/FirmwareRelease';
import { mqttConfig } from '../config/mqtt';
import logger from '../config/logger';

/** true if candidate semver > current semver */
function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split('.').map((n) => parseInt(n, 10));
  const b = current.split('.').map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

// ── GET /api/fireguard/ota/manifest ───────────────────────────────────────────
export const otaManifestPublic = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const hw = String(req.query.hw ?? 'vvm401');
  const currentFw = String(req.query.fw ?? '0.0.0');

  const release = await FirmwareRelease.findOne({ hw, active: true }).sort({ releasedAt: -1 }).lean();
  if (!release) {
    res.status(204).end();
    return;
  }
  if (!isNewer(release.version, currentFw)) {
    res.status(204).end();
    return;
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

// ── GET /api/fireguard/ota/download/:hw/:version ──────────────────────────────
export const otaDownloadPublic = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { hw, version } = req.params as { hw: string; version: string };
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw AppError.badRequest('version must be semver');

  const release = await FirmwareRelease.findOne({ hw, version, active: true }).lean();
  if (!release) throw AppError.notFound(`Firmware ${hw}@${version}`);

  const binPath = path.resolve(mqttConfig.OTA_STORAGE_DIR, hw, `${version}.bin`);
  if (!fs.existsSync(binPath)) {
    logger.warn({ binPath }, 'OTA binary file not found on disk');
    throw AppError.notFound('Firmware binary');
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Firmware-SHA256', release.sha256);
  res.setHeader('X-Firmware-Version', version);
  res.download(binPath, `${hw}-${version}.bin`);
});
