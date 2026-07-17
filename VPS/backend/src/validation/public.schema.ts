/**
 * Zod schema for POST /api/public/signup body.
 */
import { z } from 'zod';

export const SignupBodySchema = z.object({
  companyName: z.string().min(1).max(200).trim(),
  contactName: z.string().min(1).max(200).trim(),
  phone: z.string().min(7).max(20).trim(),
  email: z.string().email().toLowerCase().trim(),
});

export type SignupBody = z.infer<typeof SignupBodySchema>;
