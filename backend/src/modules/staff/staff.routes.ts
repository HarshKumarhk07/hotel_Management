import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import * as ctrl from './staff.controller';
import {
  createRoleSchema,
  updateRoleSchema,
  createStaffSchema,
  updateStaffSchema,
} from './staff.validation';

const router = Router();

router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.KITCHEN_OWNER));

// ── Roles ──
router.get('/roles', ctrl.listRoles);
router.post('/roles', validate({ body: createRoleSchema }), ctrl.createRole);
router.patch('/roles/:id', validate({ body: updateRoleSchema }), ctrl.updateRole);
router.delete('/roles/:id', ctrl.deleteRole);

// ── Staff ──
router.get('/', ctrl.listStaff);
router.post('/', validate({ body: createStaffSchema }), ctrl.createStaff);
router.get('/:id', ctrl.getStaffDetails);
router.patch('/:id', validate({ body: updateStaffSchema }), ctrl.updateStaff);

export default router;
