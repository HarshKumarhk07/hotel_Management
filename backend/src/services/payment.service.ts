import crypto from 'node:crypto';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { getRazorpay } from '@/config/razorpay';
import { PAYMENT_METHODS, PAYMENT_STATUS, REFUND_STATUS, SOCKET_EVENTS } from '@/constants';
import { Order, type IOrder } from '@/models';
import { emitToAdmins, emitToKitchen, emitToUser } from '@/realtime/emit';
import * as notifications from '@/services/notification.service';
import { safeEqual } from '@/utils/crypto';
import { AppError } from '@/utils/AppError';

/** Rupees → integer paise (Razorpay works in the smallest currency unit). */
function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature verification (pure HMAC — no SDK / network needed)
// ─────────────────────────────────────────────────────────────────────────────

/** Verify the checkout callback signature: HMAC_SHA256(orderId|paymentId, secret). */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return safeEqual(expected, signature);
}

/** Verify a webhook payload signature: HMAC_SHA256(rawBody, webhookSecret). */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return safeEqual(expected, signature);
}

// ─────────────────────────────────────────────────────────────────────────────
// Create a Razorpay order for an existing (PENDING) KDS order
// ─────────────────────────────────────────────────────────────────────────────
export async function createRazorpayOrder(order: IOrder) {
  if (order.payment.method !== PAYMENT_METHODS.RAZORPAY) {
    throw AppError.badRequest('This order is not paid online', 'NOT_RAZORPAY');
  }
  if (order.payment.status === PAYMENT_STATUS.PAID) {
    throw AppError.conflict('This order is already paid', 'ALREADY_PAID');
  }

  const rzp = getRazorpay();
  const rzpOrder = await rzp.orders.create({
    amount: toPaise(order.payment.amount),
    currency: order.payment.currency,
    receipt: order.orderNumber,
    notes: { orderId: order._id.toString(), orderNumber: order.orderNumber },
  });

  order.payment.razorpayOrderId = rzpOrder.id;
  // A fresh attempt resets a prior FAILED state back to PENDING.
  if (order.payment.status === PAYMENT_STATUS.FAILED) order.payment.status = PAYMENT_STATUS.PENDING;
  await order.save();

  return {
    keyId: env.RAZORPAY_KEY_ID,
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    orderNumber: order.orderNumber,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mark an order paid (shared by callback-verify and webhook paths, idempotent)
// ─────────────────────────────────────────────────────────────────────────────
async function markPaid(order: IOrder, razorpayPaymentId: string, signature?: string) {
  if (order.payment.status === PAYMENT_STATUS.PAID) return order; // idempotent

  order.payment.status = PAYMENT_STATUS.PAID;
  order.payment.razorpayPaymentId = razorpayPaymentId;
  if (signature) order.payment.razorpaySignature = signature;
  order.payment.paidAt = new Date();
  await order.save();

  // Razorpay orders only enter the kitchen queue once money is confirmed.
  const payload = { orderId: order._id.toString(), orderNumber: order.orderNumber, status: order.status };
  emitToKitchen(order.kitchen.toString(), SOCKET_EVENTS.ORDER_NEW, payload);
  emitToAdmins(SOCKET_EVENTS.ORDER_NEW, payload);
  if (order.customer) {
    emitToUser(order.customer.toString(), SOCKET_EVENTS.PAYMENT_UPDATED, {
      orderId: order._id.toString(),
      status: PAYMENT_STATUS.PAID,
    });
  }
  void notifications.notifyKitchenNewOrder(order);
  return order;
}

/**
 * Verify the browser checkout callback and settle the order. Throws on a bad
 * signature (and records the failure) so a forged callback can never mark an
 * order paid.
 */
export async function verifyAndSettle(
  order: IOrder,
  data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
) {
  if (order.payment.razorpayOrderId && order.payment.razorpayOrderId !== data.razorpayOrderId) {
    throw AppError.badRequest('Razorpay order mismatch', 'ORDER_MISMATCH');
  }
  const ok = verifyPaymentSignature(data.razorpayOrderId, data.razorpayPaymentId, data.razorpaySignature);
  if (!ok) {
    order.payment.failureReason = 'Signature verification failed';
    await order.save();
    throw AppError.badRequest('Payment verification failed', 'SIGNATURE_INVALID');
  }
  return markPaid(order, data.razorpayPaymentId, data.razorpaySignature);
}

export async function markFailed(order: IOrder, reason?: string) {
  if (order.payment.status === PAYMENT_STATUS.PAID) return order;
  order.payment.status = PAYMENT_STATUS.FAILED;
  order.payment.failureReason = reason ?? 'Payment failed or was cancelled';
  await order.save();
  emitToAdmins(SOCKET_EVENTS.PAYMENT_UPDATED, {
    orderId: order._id.toString(),
    status: PAYMENT_STATUS.FAILED,
  });
  void notifications.notifyAdminsPaymentFailed(order);
  return order;
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook handling (idempotent; verified upstream)
// ─────────────────────────────────────────────────────────────────────────────
interface WebhookPayload {
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; error_description?: string } };
    refund?: { entity?: { id?: string; status?: string } };
  };
}

export async function handleWebhookEvent(body: WebhookPayload): Promise<{ handled: boolean }> {
  const event = body.event;
  const payment = body.payload?.payment?.entity;
  const refund = body.payload?.refund?.entity;

  if ((event === 'payment.captured' || event === 'payment.authorized') && payment?.order_id) {
    const order = await Order.findOne({ 'payment.razorpayOrderId': payment.order_id });
    if (order) await markPaid(order, payment.id ?? 'unknown');
    return { handled: true };
  }

  if (event === 'payment.failed' && payment?.order_id) {
    const order = await Order.findOne({ 'payment.razorpayOrderId': payment.order_id });
    if (order) await markFailed(order, payment.error_description);
    return { handled: true };
  }

  if (event === 'refund.processed' && refund?.id) {
    const order = await Order.findOne({ 'refund.razorpayRefundId': refund.id });
    if (order) {
      order.refund.status = REFUND_STATUS.REFUNDED;
      order.refund.processedAt = new Date();
      await order.save();
    }
    return { handled: true };
  }

  logger.debug({ event }, 'Unhandled Razorpay webhook event');
  return { handled: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Refund processing
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Execute the staged refund for an order. Online (Razorpay) payments call the
 * gateway; COD/room-billing are settled manually (marked REFUNDED directly).
 * Walks INITIATED → PROCESSING → REFUNDED/FAILED and emits updates.
 */
export async function processRefund(order: IOrder) {
  // Fast, non-authoritative pre-checks for precise client errors.
  if (order.refund.status === REFUND_STATUS.REFUNDED) {
    throw AppError.conflict('Order is already refunded', 'ALREADY_REFUNDED');
  }
  if (order.refund.status === REFUND_STATUS.NOT_REQUIRED || order.refund.amount <= 0) {
    throw AppError.badRequest('No refund is due for this order', 'NO_REFUND_DUE');
  }

  // ── Atomic claim ──────────────────────────────────────────────────────────
  // The single source of truth for "may I refund this order now?" is this
  // findOneAndUpdate. Only a refund sitting in a *claimable* state (INITIATED or
  // a previously FAILED attempt being retried) can be moved to PROCESSING, and
  // the DB serialises the update per-document. Two concurrent refund requests
  // therefore cannot both transition the same order — the loser matches nothing
  // and is rejected, so the payment gateway is never called twice.
  const claimUpdate: Record<string, unknown> = { 'refund.status': REFUND_STATUS.PROCESSING };
  if (order.refund.reason) claimUpdate['refund.reason'] = order.refund.reason;

  const claimed = await Order.findOneAndUpdate(
    {
      _id: order._id,
      'refund.status': { $in: [REFUND_STATUS.INITIATED, REFUND_STATUS.FAILED] },
      'refund.amount': { $gt: 0 },
    },
    { $set: claimUpdate },
    { new: true },
  );

  if (!claimed) {
    // Lost the race (or nothing to refund). Re-read for a precise error.
    const fresh = await Order.findById(order._id).select('refund');
    if (fresh?.refund.status === REFUND_STATUS.REFUNDED) {
      throw AppError.conflict('Order is already refunded', 'ALREADY_REFUNDED');
    }
    if (fresh?.refund.status === REFUND_STATUS.PROCESSING) {
      throw AppError.conflict('A refund is already being processed for this order', 'REFUND_IN_PROGRESS');
    }
    throw AppError.badRequest('No refund is due for this order', 'NO_REFUND_DUE');
  }

  // From here on operate on the claimed (authoritative) document only.
  order = claimed;

  const isOnlinePaid =
    order.payment.method === PAYMENT_METHODS.RAZORPAY &&
    order.payment.status !== PAYMENT_STATUS.PENDING &&
    !!order.payment.razorpayPaymentId;

  try {
    if (isOnlinePaid) {
      const rzp = getRazorpay();
      const refund = await rzp.payments.refund(order.payment.razorpayPaymentId!, {
        amount: toPaise(order.refund.amount),
        notes: { orderNumber: order.orderNumber, reason: order.refund.reason ?? '' },
      });
      order.refund.razorpayRefundId = refund.id;
      // Some gateways finalise asynchronously via webhook; mark REFUNDED when
      // the SDK reports a terminal state, else leave PROCESSING for the webhook.
      order.refund.status =
        refund.status === 'processed' ? REFUND_STATUS.REFUNDED : REFUND_STATUS.PROCESSING;
    } else {
      // Manual/offline refund (cash, room bill adjustment).
      order.refund.status = REFUND_STATUS.REFUNDED;
    }

    if (order.refund.status === REFUND_STATUS.REFUNDED) order.refund.processedAt = new Date();

    // Reflect on the payment record.
    order.payment.status =
      order.refund.amount >= order.pricing.total
        ? PAYMENT_STATUS.REFUNDED
        : PAYMENT_STATUS.PARTIALLY_REFUNDED;
    await order.save();
  } catch (err) {
    order.refund.status = REFUND_STATUS.FAILED;
    await order.save();
    logger.error({ err, orderId: order._id.toString() }, 'Refund failed');
    throw AppError.internal('Refund could not be processed', 'REFUND_FAILED');
  }

  const payload = { orderId: order._id.toString(), refund: order.refund.status };
  if (order.customer) emitToUser(order.customer.toString(), SOCKET_EVENTS.REFUND_UPDATED, payload);
  emitToAdmins(SOCKET_EVENTS.REFUND_UPDATED, payload);
  void notifications.notifyCustomerRefund(order);
  return order;
}
