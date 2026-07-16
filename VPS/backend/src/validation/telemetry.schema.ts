/**
 * Zod schemas for telemetry query routes.
 */
import { z } from 'zod';

export const TelemetryParamsSchema = z.object({
  gatewayId: z.string().min(1),
});

export const TelemetryRangeQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export type TelemetryRangeQuery = z.infer<typeof TelemetryRangeQuerySchema>;
