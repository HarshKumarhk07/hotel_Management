import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { paymentLimiter } from '@/middleware/rateLimit';
import { ROLES } from '@/constants';
import * as ctrl from './payment.controller';
import {
  failedPaymentSchema,
  guestRazorpaySchema,
  guestVerifySchema,
  orderIdParam,
  refundSchema,
  verifyPaymentSchema,
} from './payment.validation';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Payments
 *     description: Razorpay payments, webhooks, and refunds
 */

/**
 * @openapi
 * /payments/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Razorpay webhook (HMAC-verified; no auth)
 *     responses: { 200: { description: Received }, 401: { description: Bad signature } }
 */
// Webhook first — must NOT be behind auth/rate-limit/CSRF.
router.post('/webhook', ctrl.webhook);

// ── Guest payment (no login; the opaque order access token authorizes it) ──
/**
 * @openapi
 * /payments/guest/razorpay:
 *   post: { tags: [Payments], summary: Create a Razorpay order for a guest order (token-auth), responses: { 200: { description: Razorpay order + key } } }
 * /payments/guest/verify:
 *   post: { tags: [Payments], summary: Verify a guest Razorpay callback (token-auth), responses: { 200: { description: Verified + paid } } }
 */
router.post('/guest/razorpay', paymentLimiter, validate({ body: guestRazorpaySchema }), ctrl.guestCreateOrder);
router.post('/guest/verify', paymentLimiter, validate({ body: guestVerifySchema }), ctrl.guestVerify);

// ── Customer payment actions ──
const customer = [authenticate, authorize(ROLES.CUSTOMER), paymentLimiter] as const;

/**
 * @openapi
 * /payments/orders/{orderId}/razorpay:
 *   post:
 *     tags: [Payments]
 *     summary: Create a Razorpay order for an existing KDS order
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Razorpay order + key }, 409: { description: Already paid } }
 */
router.post(
  '/orders/:orderId/razorpay',
  ...customer,
  validate({ params: orderIdParam }),
  ctrl.createOrder,
);

/**
 * @openapi
 * /payments/orders/{orderId}/verify:
 *   post:
 *     tags: [Payments]
 *     summary: Verify the Razorpay checkout callback signature and settle
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Verified + paid }, 400: { description: Signature invalid } }
 */
router.post(
  '/orders/:orderId/verify',
  ...customer,
  validate({ params: orderIdParam, body: verifyPaymentSchema }),
  ctrl.verify,
);

/**
 * @openapi
 * /payments/orders/{orderId}/failed:
 *   post:
 *     tags: [Payments]
 *     summary: Mark a payment attempt failed (enables retry)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Marked failed } }
 */
router.post(
  '/orders/:orderId/failed',
  ...customer,
  validate({ params: orderIdParam, body: failedPaymentSchema }),
  ctrl.failed,
);

// ── Staff/Admin refund ──
/**
 * @openapi
 * /payments/orders/{orderId}/refund:
 *   post:
 *     tags: [Payments]
 *     summary: Process the staged refund for an order (Kitchen Owner / Super Admin)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Refund processed }, 400: { description: No refund due } }
 */
router.post(
  '/orders/:orderId/refund',
  authenticate,
  authorize(ROLES.KITCHEN_OWNER, ROLES.SUPER_ADMIN),
  validate({ params: orderIdParam, body: refundSchema }),
  ctrl.refund,
);

export default router;
