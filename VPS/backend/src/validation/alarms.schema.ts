/**
 * Zod schemas for alarm routes.
 */
import { z } from 'zod';

export const AlarmParamsSchema = z.object({
  id: z.string().min(1),
});

export const AckAlarmSchema = z.object({
  reason: z.string().min(1, 'Acknowledge reason is required').max(500),
});

export const AlarmQuerySchema = z.object({
  siteId: z.string().optional(),
  gatewayId: z.string().optional(),
  severity: z.enum(['warning', 'critical']).optional(),
  active: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  acknowledged: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type AckAlarmBody = z.infer<typeof AckAlarmSchema>;
export type AlarmQuery = z.infer<typeof AlarmQuerySchema>;
