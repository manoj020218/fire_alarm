/**
 * Zod schemas for site routes.
 */
import { z } from 'zod';

export const CreateSiteSchema = z.object({
  siteId: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9_-]{3,20}$/, 'siteId must be 3-20 uppercase alphanumeric chars'),
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(300),
  timezone: z.string().default('Asia/Kolkata'),
  contactName: z.string().max(100).optional(),
  contactPhone: z.string().max(20).optional(),
});

export const UpdateSiteSchema = CreateSiteSchema.omit({ siteId: true }).partial();

export const SiteParamsSchema = z.object({
  siteId: z.string().min(1),
});

export type CreateSiteBody = z.infer<typeof CreateSiteSchema>;
export type UpdateSiteBody = z.infer<typeof UpdateSiteSchema>;
