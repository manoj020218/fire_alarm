/**
 * Zod schemas for maintenance log routes.
 */
import { z } from 'zod';

const MAINTENANCE_TYPES = [
  'inspection', 'repair', 'replacement', 'testing',
  'calibration', 'cleaning', 'other',
] as const;

export const CreateMaintenanceLogSchema = z.object({
  siteId: z.string().min(1),
  gatewayId: z.string().optional(),
  deviceId: z.string().optional(),
  type: z.enum(MAINTENANCE_TYPES),
  description: z.string().min(1).max(1000),
  performedAt: z.coerce.date(),
  nextDueAt: z.coerce.date().optional(),
  remarks: z.string().max(500).optional(),
});

export const MaintenanceQuerySchema = z.object({
  siteId: z.string().optional(),
  gatewayId: z.string().optional(),
  deviceId: z.string().optional(),
  type: z.enum(MAINTENANCE_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const MaintenanceParamsSchema = z.object({
  id: z.string().min(1),
});

export type CreateMaintenanceLogBody = z.infer<typeof CreateMaintenanceLogSchema>;
export type MaintenanceQuery = z.infer<typeof MaintenanceQuerySchema>;
