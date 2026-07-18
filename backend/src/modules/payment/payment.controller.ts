import type { Request, Response } from 'express';
import { AUDIT_ACTIONS, REFUND_STATUS, ROLES } from '@/constants';
import { Order } from '@/models';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import { auditFromRequest, recordAudit } from '@/services/audit.service';
import * as payment from '@/services/payment.service';
import { getByGuestToken } from '@/modules/order/order.service';

/** Load an order owned by the current customer (for payment actions). */
async function ownOrder(req: Request) {
  const order = await Order.findById(req.params.orderId);
  if (!order || !order.customer || order.customer.toString() !== req.auth!.userId) {
    throw AppError.notFound('Order not found');
  }
  return order;
}

// ── Customer: create a Razorpay order ──
export const createOrder = asyncHandler(async (req: Request, res) => {
  const order = await ownOrder(req);
  const data = await payment.createRazorpayOrder(order);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.PAYMENT_INITIATED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${order._id.toString()}`,
  });
  return ok(res, data);
});

// ── Customer: verify checkout callback ──
export const verify = asyncHandler(async (req: Request, res) => {
  const order = await ownOrder(req);
  const updated = await payment.verifyAndSettle(order, req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.PAYMENT_VERIFIED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${order._id.toString()}`,
  });
  return ok(res, { payment: updated.payment, message: 'Payment verified' });
});

// ── Customer: report a failed/abandoned attempt ──
export const failed = asyncHandler(async (req: Request, res) => {
  const order = await ownOrder(req);
  await payment.markFailed(order, req.body.reason);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.PAYMENT_FAILED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${order._id.toString()}`,
    metadata: { reason: req.body.reason },
  });
  return ok(res, { message: 'Payment marked as failed. You can retry.' });
});

// ── Guest: create a Razorpay order (authenticated by the order access token) ──
export const guestCreateOrder = asyncHandler(async (req: Request, res) => {
  const order = await getByGuestToken(req.body.token);
  const data = await payment.createRazorpayOrder(order);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.PAYMENT_INITIATED,
    actorEmail: order.guestInfo?.email,
    target: `order:${order._id.toString()}`,
    metadata: { guest: true },
  });
  return ok(res, data);
});

// ── Guest: verify checkout callback (authenticated by the order access token) ──
export const guestVerify = asyncHandler(async (req: Request, res) => {
  const order = await getByGuestToken(req.body.token);
  const updated = await payment.verifyAndSettle(order, req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.PAYMENT_VERIFIED,
    actorEmail: order.guestInfo?.email,
    target: `order:${order._id.toString()}`,
    metadata: { guest: true },
  });
  return ok(res, { payment: updated.payment, message: 'Payment verified' });
});

/**
 * Razorpay webhook. No auth — authenticity is established by the HMAC signature
 * over the raw body. Always returns 200 quickly for handled/ignored events so
 * Razorpay doesn't retry storms; rejects only on a bad/missing signature.
 */
export const webhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  if (!signature || !payment.verifyWebhookSignature(raw, signature)) {
    throw AppError.unauthorized('Invalid webhook signature', 'WEBHOOK_INVALID');
  }
  const result = await payment.handleWebhookEvent(req.body);
  void recordAudit({
    action: AUDIT_ACTIONS.PAYMENT_WEBHOOK,
    metadata: { event: req.body?.event, handled: result.handled },
  });
  return ok(res, { received: true, handled: result.handled });
});

// ── Staff/Admin: process a staged refund ──
export const refund = asyncHandler(async (req: Request, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw AppError.notFound('Order not found');
  // Kitchen owners may only refund their own kitchen's orders.
  if (req.auth!.role === ROLES.KITCHEN_OWNER && order.kitchen.toString() !== req.auth!.kitchenId) {
    throw AppError.forbidden('Order belongs to a different kitchen', 'CROSS_TENANT_DENIED');
  }
  if (req.body.reason) order.refund.reason = req.body.reason;

  const updated = await payment.processRefund(order);
  void auditFromRequest(req, {
    action:
      updated.refund.status === REFUND_STATUS.FAILED
        ? AUDIT_ACTIONS.REFUND_FAILED
        : AUDIT_ACTIONS.REFUND_PROCESSED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${order._id.toString()}`,
    metadata: { status: updated.refund.status, amount: updated.refund.amount },
  });
  return ok(res, { refund: updated.refund, payment: updated.payment });
});
