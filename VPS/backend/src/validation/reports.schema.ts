/**
 * Zod schemas for report routes.
 */
import { z } from 'zod';

export const GenerateReportSchema = z.object({
  siteId: z.string().min(1),
  type: z.enum(['daily', 'weekly', 'monthly', 'custom', 'alarm_summary']),
  format: z.enum(['pdf', 'csv']),
  rangeFrom: z.coerce.date(),
  rangeTo: z.coerce.date(),
});

export const ReportQuerySchema = z.object({
  siteId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GenerateReportBody = z.infer<typeof GenerateReportSchema>;
export type ReportQuery = z.infer<typeof ReportQuerySchema>;
