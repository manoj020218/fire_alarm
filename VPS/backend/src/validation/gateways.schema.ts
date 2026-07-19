/**
 * Zod schemas for gateway routes.
 */
import { z } from 'zod';

export const GatewayParamsSchema = z.object({
  id: z.string().min(1),
});

export const UpdateGatewaySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  fw: z.string().optional(),
  hw: z.string().optional(),
});

export const ThresholdSchema = z.object({
  low: z.number().optional(),
  high: z.number().optional(),
  lowCritical: z.number().optional(),
  highCritical: z.number().optional(),
});

export const GatewayConfigSchema = z.object({
  thresholds: z.record(z.string(), ThresholdSchema).optional(),
  pollIntervalSec: z.number().int().min(5).max(3600).optional(),
  customSettings: z.record(z.string(), z.unknown()).optional(),
});

export const GatewayCommandSchema = z.object({
  command: z.enum([
    'reboot',
    'sync_time',
    'force_mqtt_reconnect',
    'test_alarm',
    // SIM / cellular commands (gateway replies on the /sim topic)
    'sim_info',
    'read_sms',
    'ussd',
    'test_sms',
  ]),
  params: z.record(z.string(), z.unknown()).optional(),
});

/** PUT /api/gateways/:id/sms — SMS alerting + operator config. */
export const SmsConfigSchema = z.object({
  enabled: z.boolean(),
  // comma-separated E.164 numbers; allow empty when disabling
  numbers: z.string().max(400).default(''),
  operator: z.enum(['airtel', 'jio', 'vi', 'bsnl', 'custom']).optional(),
  balanceUssd: z.string().max(20).optional(),
  numberUssd: z.string().max(20).optional(),
});

// ── Add-Gateway (claim) ────────────────────────────────────────────────────────

/** Customer claims a pre-provisioned gateway using the code printed on the unit. */
export const ClaimGatewaySchema = z.object({
  gatewayId: z.string().min(3).max(64).trim(),
  claimCode: z.string().min(4).max(32).trim(),
  name: z.string().min(1).max(100).trim().optional(),
  siteId: z.string().min(1).optional(),
});

/** Super-admin pre-provisions a gateway into the claimable pool. */
export const PoolGatewaySchema = z.object({
  gatewayId: z.string().min(3).max(64).trim(),
  name: z.string().min(1).max(100).trim().optional(),
});

export type GatewayConfigBody = z.infer<typeof GatewayConfigSchema>;
export type GatewayCommandBody = z.infer<typeof GatewayCommandSchema>;
export type ClaimGatewayBody = z.infer<typeof ClaimGatewaySchema>;
export type PoolGatewayBody = z.infer<typeof PoolGatewaySchema>;
export type SmsConfigBody = z.infer<typeof SmsConfigSchema>;
