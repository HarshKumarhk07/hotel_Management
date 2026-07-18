import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { guestCheckoutLimiter } from '@/middleware/rateLimit';
import { ROLES } from '@/constants';
import * as ctrl from './order.controller';
import {
  cancelItemsSchema,
  cancelOrderSchema,
  checkoutSchema,
  guestCheckoutSchema,
  guestTokenParam,
  internalNoteSchema,
  listOrdersSchema,
  orderIdParam,
  updateStatusSchema,
  refundRequestSchema,
} from './order.validation';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Orders
 *     description: Checkout, order tracking, and the kitchen order lifecycle
 */

// ── Public (guest, no authentication) ──
/**
 * @openapi
 * /orders/guest-checkout:
 *   post:
 *     tags: [Orders]
 *     summary: Place an order as a guest (no account). Returns an access token.
 *     responses: { 201: { description: Order placed }, 400: { description: Invalid / empty } }
 * /orders/track/{token}:
 *   get:
 *     tags: [Orders]
 *     summary: Track a guest order with its opaque access token
 *     responses: { 200: { description: Order }, 404: { description: Not found } }
 */
router.post('/guest-checkout', guestCheckoutLimiter, validate({ body: guestCheckoutSchema }), ctrl.guestCheckout);
router.get('/track/:token', validate({ params: guestTokenParam }), ctrl.trackGuestOrder);

// Everything below requires authentication.
router.use(authenticate);

const customer = authorize(ROLES.CUSTOMER);
const staff = authorize(ROLES.KITCHEN_OWNER, ROLES.SUPER_ADMIN);

// ── Customer ──
/**
 * @openapi
 * /orders/link-guest-orders:
 *   post:
 *     tags: [Orders]
 *     summary: Claim this account's prior guest orders (verified email/phone)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Number of orders linked } }
 */
router.post('/link-guest-orders', customer, ctrl.linkMyGuestOrders);
/**
 * @openapi
 * /orders/checkout:
 *   post:
 *     tags: [Orders]
 *     summary: Place an order from the cart (prices recomputed server-side)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Order placed }, 400: { description: Empty cart / unavailable items } }
 */
router.post('/checkout', customer, validate({ body: checkoutSchema }), ctrl.checkout);

/**
 * @openapi
 * /orders/my:
 *   get: { tags: [Orders], summary: List my orders (order history), security: [{ bearerAuth: [] }], responses: { 200: { description: Orders } } }
 */
router.get('/my', customer, validate({ query: listOrdersSchema }), ctrl.myOrders);

/**
 * @openapi
 * /orders/my/{id}:
 *   get: { tags: [Orders], summary: Track one of my orders, security: [{ bearerAuth: [] }], responses: { 200: { description: Order } } }
 */
router.get('/my/:id', customer, validate({ params: orderIdParam }), ctrl.myOrder);

// ── Staff (Kitchen Owner / Super Admin) ──
/**
 * @openapi
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: List orders (kitchen owner=own kitchen, admin=all/filter)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Orders } }
 */
router.get('/', staff, validate({ query: listOrdersSchema }), ctrl.staffList);

/**
 * @openapi
 * /orders/{id}:
 *   get: { tags: [Orders], summary: Get an order with internal notes (staff), security: [{ bearerAuth: [] }], responses: { 200: { description: Order } } }
 */
router.get('/:id', staff, validate({ params: orderIdParam }), ctrl.staffGet);

/**
 * @openapi
 * /orders/{id}/status:
 *   patch:
 *     tags: [Orders]
 *     summary: Advance the order status (validated transitions)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Updated }, 400: { description: Invalid transition } }
 */
router.patch('/:id/status', staff, validate({ params: orderIdParam, body: updateStatusSchema }), ctrl.updateStatus);

/**
 * @openapi
 * /orders/{id}/cancel:
 *   post: { tags: [Orders], summary: Cancel the whole order (staff), security: [{ bearerAuth: [] }], responses: { 200: { description: Cancelled } } }
 * /orders/{id}/cancel-items:
 *   post: { tags: [Orders], summary: Cancel specific item quantities (staff), security: [{ bearerAuth: [] }], responses: { 200: { description: Updated } } }
 * /orders/{id}/notes:
 *   post: { tags: [Orders], summary: Add a private internal note (staff), security: [{ bearerAuth: [] }], responses: { 200: { description: Updated } } }
 */
router.post('/:id/cancel', staff, validate({ params: orderIdParam, body: cancelOrderSchema }), ctrl.cancelOrder);
router.post('/:id/cancel-items', staff, validate({ params: orderIdParam, body: cancelItemsSchema }), ctrl.cancelItems);
router.post('/:id/notes', staff, validate({ params: orderIdParam, body: internalNoteSchema }), ctrl.addNote);

// Refund approval workflow
router.post('/:id/refund-request', staff, validate({ params: orderIdParam, body: refundRequestSchema }), ctrl.requestRefund);
router.post('/:id/refund-approve', authorize(ROLES.SUPER_ADMIN), validate({ params: orderIdParam }), ctrl.approveRefund);
router.post('/:id/refund-reject', authorize(ROLES.SUPER_ADMIN), validate({ params: orderIdParam, body: refundRequestSchema }), ctrl.rejectRefund);

// Invoice — staff + the order's own customer
router.get('/:id/invoice', authenticate, validate({ params: orderIdParam }), ctrl.downloadInvoice);

export default router;
