import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { couponLimiter } from '@/middleware/rateLimit';
import { ROLES } from '@/constants';
import * as ctrl from './coupon.controller';
import {
  couponIdParam,
  createCouponSchema,
  listCouponsSchema,
  updateCouponSchema,
  validateCouponSchema,
} from './coupon.validation';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Coupons
 *     description: Discount coupons (Super Admin manages; customers apply)
 */

/**
 * @openapi
 * /coupons/validate:
 *   post:
 *     tags: [Coupons]
 *     summary: Preview a coupon discount for a cart subtotal (customer)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Discount preview }, 400: { description: Invalid/expired/limit } }
 */
router.post(
  '/validate',
  authorize(ROLES.CUSTOMER),
  couponLimiter,
  validate({ body: validateCouponSchema }),
  ctrl.validate,
);

// ── Super Admin management ──
const admin = authorize(ROLES.SUPER_ADMIN);

/**
 * @openapi
 * /coupons:
 *   post: { tags: [Coupons], summary: Create a coupon, security: [{ bearerAuth: [] }], responses: { 201: { description: Created } } }
 *   get: { tags: [Coupons], summary: List coupons, security: [{ bearerAuth: [] }], responses: { 200: { description: Coupons } } }
 */
router
  .route('/')
  .post(admin, validate({ body: createCouponSchema }), ctrl.create)
  .get(admin, validate({ query: listCouponsSchema }), ctrl.list);

/**
 * @openapi
 * /coupons/{id}:
 *   get: { tags: [Coupons], summary: Get a coupon, security: [{ bearerAuth: [] }], responses: { 200: { description: Coupon } } }
 *   patch: { tags: [Coupons], summary: Update a coupon, security: [{ bearerAuth: [] }], responses: { 200: { description: Updated } } }
 *   delete: { tags: [Coupons], summary: Delete a coupon, security: [{ bearerAuth: [] }], responses: { 204: { description: Deleted } } }
 */
router
  .route('/:id')
  .get(admin, validate({ params: couponIdParam }), ctrl.getOne)
  .patch(admin, validate({ params: couponIdParam, body: updateCouponSchema }), ctrl.update)
  .delete(admin, validate({ params: couponIdParam }), ctrl.remove);

export default router;
