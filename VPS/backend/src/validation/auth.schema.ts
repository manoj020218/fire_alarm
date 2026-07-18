/**
 * Zod schemas for auth routes.
 */
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export const GoogleLoginSchema = z.object({
  idToken: z.string().min(20, 'idToken is required'),
});

export type LoginBody = z.infer<typeof LoginSchema>;
export type RefreshBody = z.infer<typeof RefreshSchema>;
export type GoogleLoginBody = z.infer<typeof GoogleLoginSchema>;
