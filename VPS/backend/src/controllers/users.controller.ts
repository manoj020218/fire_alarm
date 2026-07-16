/**
 * Users controller — RBAC-gated CRUD.
 * Callers can only create users with a role <= their own level.
 */
import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { User, ROLE_HIERARCHY, type IUserDocument } from '../models/User';
import { hashPassword } from '../services/auth.service';
import { writeAudit } from '../services/audit.service';
import { scopeFilter } from '../utils/scope';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import type { CreateUserBody, UpdateUserBody, UserQuery } from '../validation/users.schema';

// ── GET /api/users ────────────────────────────────────────────────────────────

export const listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const q = req.query as unknown as UserQuery;
  const { siteId, role, active, page, limit } = q;

  const baseFilter: FilterQuery<IUserDocument> = {};
  if (siteId !== undefined) baseFilter['siteIds'] = siteId;
  if (role !== undefined) baseFilter['role'] = role;
  if (active !== undefined) baseFilter['active'] = active;

  // User docs carry a `siteIds` array, not a single `siteId`
  const scopedFilter = scopeFilter<IUserDocument>(req.user, baseFilter, 'siteIds');
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(scopedFilter).sort({ name: 1 }).skip(skip).limit(limit),
    User.countDocuments(scopedFilter),
  ]);

  res.json({
    ok: true,
    users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ── GET /api/users/:id ────────────────────────────────────────────────────────

export const getUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as { id: string };

  const user = await User.findById(id);
  if (!user) throw AppError.notFound('User');

  res.json({ ok: true, user });
});

// ── POST /api/users ───────────────────────────────────────────────────────────

export const createUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const body = req.body as CreateUserBody;

  // Caller can only create users with role <= their own level
  if (ROLE_HIERARCHY[body.role] > ROLE_HIERARCHY[req.user.role]) {
    throw AppError.forbidden('Cannot create a user with a higher role than your own');
  }

  const passwordHash = await hashPassword(body.password);
  const user = await User.create({
    email: body.email,
    passwordHash,
    name: body.name,
    role: body.role,
    siteIds: body.siteIds,
    active: true,
  });

  await writeAudit({
    action: 'CREATE',
    entity: 'User',
    entityId: String(user._id),
    after: { email: user.email, role: user.role, siteIds: user.siteIds },
    req,
  });

  // Never return passwordHash
  res.status(201).json({
    ok: true,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      siteIds: user.siteIds,
      active: user.active,
    },
  });
});

// ── PUT /api/users/:id ────────────────────────────────────────────────────────

export const updateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as { id: string };
  const body = req.body as UpdateUserBody;

  const before = await User.findById(id);
  if (!before) throw AppError.notFound('User');

  // Cannot elevate a user above own role
  if (body.role !== undefined && ROLE_HIERARCHY[body.role] > ROLE_HIERARCHY[req.user.role]) {
    throw AppError.forbidden('Cannot assign a role higher than your own');
  }

  const user = await User.findByIdAndUpdate(
    id,
    { $set: body },
    { new: true }
  );

  await writeAudit({
    action: 'UPDATE',
    entity: 'User',
    entityId: id,
    before: { role: before.role, siteIds: before.siteIds, active: before.active },
    after: { role: user?.role, siteIds: user?.siteIds, active: user?.active },
    req,
  });

  res.json({ ok: true, user });
});

// ── DELETE /api/users/:id (soft-deactivate) ───────────────────────────────────

export const deleteUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as { id: string };

  // Cannot delete self
  if (req.user.sub === id) {
    throw AppError.badRequest('Cannot deactivate your own account');
  }

  const user = await User.findById(id);
  if (!user) throw AppError.notFound('User');

  await User.findByIdAndUpdate(id, { $set: { active: false } });

  await writeAudit({
    action: 'DELETE',
    entity: 'User',
    entityId: id,
    before: { email: user.email, role: user.role, active: user.active },
    req,
  });

  res.json({ ok: true, message: 'User deactivated' });
});
