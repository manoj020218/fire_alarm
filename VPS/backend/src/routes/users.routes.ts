/**
 * Users routes — RBAC-gated CRUD.
 * GET    /api/users      — CLIENT_ADMIN+
 * GET    /api/users/:id  — CLIENT_ADMIN+
 * POST   /api/users      — CLIENT_ADMIN+
 * PUT    /api/users/:id  — CLIENT_ADMIN+
 * DELETE /api/users/:id  — CLIENT_ADMIN+
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  UserQuerySchema,
  UserParamsSchema,
  CreateUserSchema,
  UpdateUserSchema,
} from '../validation/users.schema';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/users.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('CLIENT_ADMIN'));

router.get('/', validate({ query: UserQuerySchema }), listUsers);
router.get('/:id', validate({ params: UserParamsSchema }), getUser);
router.post('/', validate({ body: CreateUserSchema }), createUser);
router.put('/:id', validate({ params: UserParamsSchema, body: UpdateUserSchema }), updateUser);
router.delete('/:id', validate({ params: UserParamsSchema }), deleteUser);

export default router;
