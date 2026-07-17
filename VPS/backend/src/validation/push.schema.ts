/**
 * Zod schemas for push-token routes.
 */
import { z } from 'zod';

export const RegisterPushSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(['android', 'ios', 'web']).default('android'),
});

export const UnregisterPushSchema = z.object({
  token: z.string().min(10).max(4096),
});

export type RegisterPushBody = z.infer<typeof RegisterPushSchema>;
export type UnregisterPushBody = z.infer<typeof UnregisterPushSchema>;
