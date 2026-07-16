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
  command: z.enum(['reboot', 'sync_time', 'force_mqtt_reconnect', 'test_alarm']),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type GatewayConfigBody = z.infer<typeof GatewayConfigSchema>;
export type GatewayCommandBody = z.infer<typeof GatewayCommandSchema>;
