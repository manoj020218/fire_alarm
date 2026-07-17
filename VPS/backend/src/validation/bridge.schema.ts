/**
 * Zod schemas for the billing bridge routes.
 */
import { z } from 'zod';

export const ProvisionBodySchema = z.object({
  orgName: z.string().min(1).max(150),
  adminName: z.string().min(1).max(100),
  adminEmail: z.string().email('adminEmail must be a valid email'),
  phone: z.string().max(30).optional(),
  trialEndsAt: z.string().datetime({ offset: true, message: 'trialEndsAt must be an ISO 8601 datetime' }),
});

export type ProvisionBody = z.infer<typeof ProvisionBodySchema>;
