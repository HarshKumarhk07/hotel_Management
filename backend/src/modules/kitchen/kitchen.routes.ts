import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import * as ctrl from './kitchen.controller';
import {
  createKitchenSchema,
  kitchenIdParam,
  listKitchensSchema,
  updateKitchenSchema,
} from './kitchen.validation';

const router = Router();

// Public: list active kitchens (landing page showcase). No auth.
router.get('/public', ctrl.listPublic);

// Dashboard route for kitchen owners & super admins (registered before /:id)
router.get(
  '/my-kitchen/dashboard',
  authenticate,
  authorize(ROLES.KITCHEN_OWNER, ROLES.SUPER_ADMIN),
  ctrl.getDashboard,
);

// Admin-only kitchen list/create
router
  .route('/')
  .post(authenticate, authorize(ROLES.SUPER_ADMIN), validate({ body: createKitchenSchema }), ctrl.create)
  .get(authenticate, authorize(ROLES.SUPER_ADMIN), validate({ query: listKitchensSchema }), ctrl.list);

// Kitchen get/update (Super Admin or Kitchen Owner)
router
  .route('/:id')
  .get(
    authenticate,
    authorize(ROLES.SUPER_ADMIN, ROLES.KITCHEN_OWNER),
    validate({ params: kitchenIdParam }),
    ctrl.getOne,
  )
  .patch(
    authenticate,
    authorize(ROLES.SUPER_ADMIN, ROLES.KITCHEN_OWNER),
    validate({ params: kitchenIdParam, body: updateKitchenSchema }),
    ctrl.update,
  );

// Admin-only activation states
router.patch(
  '/:id/activate',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: kitchenIdParam }),
  ctrl.activate,
);
router.patch(
  '/:id/deactivate',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: kitchenIdParam }),
  ctrl.deactivate,
);

export default router;
