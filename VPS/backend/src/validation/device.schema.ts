/**
 * Zod schemas for device HTTP contract endpoints.
 */
import { z } from 'zod';

// ─── Backup (POST /api/fireguard/backup) ──────────────────────────────────────

export const BackupBodySchema = z.object({
  gatewayId: z.string().min(1),
  fwVersion: z.string().min(1),
  ts: z.number().positive(),
  config: z.unknown(),
  alarmState: z.unknown(),
  undelivered: z.unknown(),
  health: z.unknown(),
});

export type BackupBody = z.infer<typeof BackupBodySchema>;

// ─── OTA manifest query (GET /api/fireguard/ota/manifest) ────────────────────

export const OtaManifestQuerySchema = z.object({
  gw: z.string().min(1),
  fw: z.string().regex(/^\d+\.\d+\.\d+$/, 'fw must be semver'),
  hw: z.string().min(1).default('vvm401'),
});

export type OtaManifestQuery = z.infer<typeof OtaManifestQuerySchema>;

// ─── OTA binary params (GET /api/fireguard/ota/binary/:hw/:version) ──────────

export const OtaBinaryParamsSchema = z.object({
  hw: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semver'),
});

export type OtaBinaryParams = z.infer<typeof OtaBinaryParamsSchema>;
