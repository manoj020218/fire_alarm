/**
 * Zod schemas for user management routes.
 */
import { z } from 'zod';
import { ROLES } from '../models/User';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 chars'),
  name: z.string().min(1).max(100),
  role: z.enum(ROLES),
  siteIds: z.array(z.string()).default([]),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(ROLES).optional(),
  siteIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const UserParamsSchema = z.object({
  id: z.string().min(1),
});

export const UserQuerySchema = z.object({
  siteId: z.string().optional(),
  role: z.enum(ROLES).optional(),
  active: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateUserBody = z.infer<typeof CreateUserSchema>;
export type UpdateUserBody = z.infer<typeof UpdateUserSchema>;
export type UserQuery = z.infer<typeof UserQuerySchema>;
