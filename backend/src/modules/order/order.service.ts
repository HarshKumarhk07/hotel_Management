import { type FilterQuery } from 'mongoose';
import {
  CANCELLABLE_STATUSES,
  ORDER_STATUS,
  ORDER_TRANSITIONS,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  SOCKET_EVENTS,
  type OrderStatus,
  type PaymentMethod,
} from '@/constants';
import {
  Cart,
  Kitchen,
  MenuItem,
  Order,
  Room,
  type IOrder,
  type IOrderItem,
} from '@/models';
import { computePricing, recomputeLine, recomputeOrderTotals } from '@/services/pricing.service';
import { processRefund } from '@/services/payment.service';
import { isAvailableNow, isKitchenAvailableNow } from '@/utils/availability';
import { generateOrderNumber } from '@/utils/orderNumber';
import { generateSecureToken, hashToken } from '@/utils/crypto';
import { normalizeEmail, normalizePhone } from '@/utils/normalize';
import { emitToAdmins, emitToKitchen, emitToUser } from '@/realtime/emit';
import * as notifications from '@/services/notification.service';
import {
  recordRedemption,
  releaseCoupon,
  releaseUserLimit,
  reserveCoupon,
  reserveUserLimit,
  validateCoupon,
} from '@/modules/coupon/coupon.service';
import { AppError } from '@/utils/AppError';

// ─────────────────────────────────────────────────────────────────────────────
// Serialization — customers must never see internal notes or payment internals.
// ─────────────────────────────────────────────────────────────────────────────
export function toCustomerView(order: IOrder) {
  const o = order.toObject({ depopulate: true });
  delete (o as Record<string, unknown>).internalNotes;
  if (o.payment) {
    delete (o.payment as Record<string, unknown>).razorpaySignature;
    delete (o.payment as Record<string, unknown>).failureReason;
  }
  return o;
}

function assertPaymentMethodAllowed(method: PaymentMethod, kitchen: { settings: { acceptsCOD: boolean; acceptsRoomBilling: boolean } }) {
  if (method === PAYMENT_METHODS.COD && !kitchen.settings.acceptsCOD) {
    throw AppError.badRequest('Cash on delivery is not available for this kitchen', 'COD_DISABLED');
  }
  if (method === PAYMENT_METHODS.ROOM_BILLING && !kitchen.settings.acceptsRoomBilling) {
    throw AppError.badRequest('Room billing is not available for this kitchen', 'ROOM_BILLING_DISABLED');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout — convert the customer's cart into an order.
// ─────────────────────────────────────────────────────────────────────────────
export async function checkout(
  customerId: string,
  input: {
    kitchen: string;
    paymentMethod: PaymentMethod;
    customerNote?: string;
    couponCode?: string;
  },
) {
  const cart = await Cart.findOne({ customer: customerId, kitchen: input.kitchen });
  if (!cart || cart.items.length === 0) {
    throw AppError.badRequest('Your cart is empty', 'CART_EMPTY');
  }

  const kitchen = await Kitchen.findById(input.kitchen).select(
    'name settings isActive temporarilyClosed weeklySchedule holidayTimings timings',
  );
  if (!kitchen || !isKitchenAvailableNow(kitchen)) {
    throw AppError.badRequest('Kitchen is currently closed', 'KITCHEN_CLOSED');
  }
  assertPaymentMethodAllowed(input.paymentMethod, kitchen);

  const room = await Room.findById(cart.room);
  if (!room || !room.isActive) throw AppError.badRequest('Room is no longer active', 'ROOM_INVALID');

  // Re-validate every line against the live menu (stock/availability/price).
  const menuItems = await MenuItem.find({ _id: { $in: cart.items.map((i) => i.menuItem) } });
  const byId = new Map(menuItems.map((m) => [m._id.toString(), m]));

  const priceable = cart.items.map((ci) => {
    const item = byId.get(ci.menuItem.toString());
    if (!item || !item.isActive || !item.inStock || !isAvailableNow(item.availability)) {
      throw AppError.conflict(
        `"${item?.name ?? 'An item'}" is no longer available. Please update your cart.`,
        'ITEM_UNAVAILABLE',
      );
    }
    if (item.stockQuantity !== null && item.stockQuantity < ci.quantity) {
      throw AppError.conflict(
        `"${item.name}" only has ${item.stockQuantity} items in stock. Please update your cart.`,
        'ITEM_OUT_OF_STOCK',
      );
    }
    return {
      item: { _id: item._id, name: item.name, foodLabel: item.foodLabel, price: item.price, taxPercent: item.taxPercent },
      quantity: ci.quantity,
      note: ci.note,
    };
  });

  const pricing = computePricing(priceable, {
    serviceChargePercent: kitchen.settings.serviceChargePercent,
  });

  // Apply a coupon if supplied: validate, atomically reserve a use, and fold the
  // discount into the frozen totals. The reservation is released if order
  // creation fails so a failed checkout never burns a coupon use.
  let appliedCoupon: { id: string; discount: number } | undefined;
  if (input.couponCode) {
    const { coupon, discount } = await validateCoupon(input.couponCode, {
      userId: customerId,
      kitchenId: kitchen._id.toString(),
      subtotal: pricing.subtotal,
    });
    // Reserve the global use first, then the per-user use — both atomic. If the
    // per-user reservation loses a concurrent race, release the global use so a
    // rejected checkout never burns a coupon.
    const reserved = await reserveCoupon(coupon._id.toString());
    if (!reserved) throw AppError.badRequest('This coupon has reached its usage limit', 'COUPON_EXHAUSTED');
    const userReserved = await reserveUserLimit(coupon._id.toString(), customerId, coupon.perUserLimit);
    if (!userReserved) {
      await releaseCoupon(coupon._id.toString());
      throw AppError.badRequest('You have already used this coupon', 'COUPON_USER_LIMIT');
    }
    appliedCoupon = { id: coupon._id.toString(), discount };
    pricing.discount = discount;
    pricing.total = Math.max(0, pricing.subtotal + pricing.taxTotal + pricing.serviceCharge - discount);
  }

  const estimatedPrepMinutes = Math.max(
    0,
    ...menuItems.map((m) => m.prepTimeMinutes),
    0,
  );

  // Create with a unique order number (retry once on the rare collision).
  let order: IOrder | null = null;
  for (let attempt = 0; attempt < 3 && !order; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      order = await Order.create({
        orderNumber: generateOrderNumber(),
        kitchen: kitchen._id,
        room: room._id,
        roomSnapshot: { roomNumber: room.roomNumber, floor: room.floor },
        customer: customerId,
        items: pricing.items,
        pricing: { ...pricing, currency: 'INR' },
        coupon: appliedCoupon?.id,
        customerNote: input.customerNote ?? cart.customerNote,
        status: ORDER_STATUS.NEW_ORDER,
        statusHistory: [{ status: ORDER_STATUS.NEW_ORDER, at: new Date(), by: customerId as never }],
        payment: {
          method: input.paymentMethod,
          status: PAYMENT_STATUS.PENDING,
          amount: pricing.total,
          currency: 'INR',
        },
        refund: { status: REFUND_STATUS.NOT_REQUIRED, amount: 0 },
        estimatedPrepMinutes,
      });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000 && attempt < 2) continue;
      if (appliedCoupon) {
        // Don't burn either reservation on a failed checkout.
        await releaseCoupon(appliedCoupon.id);
        await releaseUserLimit(appliedCoupon.id, customerId);
      }
      throw err;
    }
  }
  if (!order) {
    if (appliedCoupon) {
      await releaseCoupon(appliedCoupon.id);
      await releaseUserLimit(appliedCoupon.id, customerId);
    }
    throw AppError.internal('Could not place order, please retry', 'ORDER_CREATE_FAILED');
  }

  // Record the coupon redemption (drives per-user limits).
  if (appliedCoupon) {
    await recordRedemption(appliedCoupon.id, customerId, order._id.toString(), appliedCoupon.discount);
  }

  // Cart consumed.
  await Cart.deleteOne({ _id: cart._id });

  // Decrement stock quantities
  for (const ci of cart.items) {
    const item = byId.get(ci.menuItem.toString());
    if (item && item.stockQuantity !== null) {
      item.stockQuantity = Math.max(0, item.stockQuantity - ci.quantity);
      if (item.stockQuantity === 0) {
        item.inStock = false;
      }
      await item.save();
    }
  }

  // Notify the kitchen queue + admins in real time. Razorpay orders are held
  // back until payment is verified (the payment service emits ORDER_NEW then),
  // so the kitchen never sees an unpaid online order.
  void notifications.notifyCustomerOrderReceived(order);
  if (input.paymentMethod !== PAYMENT_METHODS.RAZORPAY) {
    const payload = { orderId: order._id.toString(), orderNumber: order.orderNumber, status: order.status };
    emitToKitchen(kitchen._id.toString(), SOCKET_EVENTS.ORDER_NEW, payload);
    emitToAdmins(SOCKET_EVENTS.ORDER_NEW, payload);
    void notifications.notifyKitchenNewOrder(order);
  }

  return order;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guest checkout — place an order with no account. Items come from the request
// (no server cart); prices are still recomputed from the live menu so a guest
// can never dictate prices. Returns the order plus a one-time opaque access
// token the guest uses to pay/track without logging in.
// ─────────────────────────────────────────────────────────────────────────────
export interface GuestCheckoutInput {
  kitchen: string;
  room: string;
  items: { menuItem: string; quantity: number; note?: string }[];
  guest: { name: string; email: string; phone: string };
  paymentMethod: PaymentMethod;
  customerNote?: string;
  couponCode?: string;
}

export async function guestCheckout(
  input: GuestCheckoutInput,
): Promise<{ order: IOrder; guestAccessToken: string }> {
  if (input.items.length === 0) throw AppError.badRequest('Your cart is empty', 'CART_EMPTY');

  const kitchen = await Kitchen.findById(input.kitchen).select(
    'name settings isActive temporarilyClosed weeklySchedule holidayTimings timings',
  );
  if (!kitchen || !isKitchenAvailableNow(kitchen)) {
    throw AppError.badRequest('Kitchen is currently closed', 'KITCHEN_CLOSED');
  }
  assertPaymentMethodAllowed(input.paymentMethod, kitchen);

  const room = await Room.findById(input.room);
  if (!room || !room.isActive) throw AppError.badRequest('Room is no longer active', 'ROOM_INVALID');
  if (room.kitchen && room.kitchen.toString() !== kitchen._id.toString()) {
    throw AppError.badRequest('This room is not served by that kitchen', 'ROOM_KITCHEN_MISMATCH');
  }

  // Re-validate every requested line against the live menu (server price authority).
  const menuItems = await MenuItem.find({ _id: { $in: input.items.map((i) => i.menuItem) } });
  const byId = new Map(menuItems.map((m) => [m._id.toString(), m]));

  const priceable = input.items.map((ci) => {
    const item = byId.get(ci.menuItem);
    if (
      !item ||
      !item.isActive ||
      !item.inStock ||
      item.kitchen.toString() !== kitchen._id.toString() ||
      !isAvailableNow(item.availability)
    ) {
      throw AppError.conflict(
        `"${item?.name ?? 'An item'}" is no longer available. Please update your cart.`,
        'ITEM_UNAVAILABLE',
      );
    }
    if (item.stockQuantity !== null && item.stockQuantity < ci.quantity) {
      throw AppError.conflict(
        `"${item.name}" only has ${item.stockQuantity} items in stock. Please update your cart.`,
        'ITEM_OUT_OF_STOCK',
      );
    }
    return {
      item: { _id: item._id, name: item.name, foodLabel: item.foodLabel, price: item.price, taxPercent: item.taxPercent },
      quantity: ci.quantity,
      note: ci.note,
    };
  });

  const pricing = computePricing(priceable, {
    serviceChargePercent: kitchen.settings.serviceChargePercent,
  });

  // Coupon: guests are bounded by the global usage limit only (no per-user limit
  // and no redemption record, since there is no account to attribute it to).
  let appliedCoupon: { id: string; discount: number } | undefined;
  if (input.couponCode) {
    const { coupon, discount } = await validateCoupon(input.couponCode, {
      kitchenId: kitchen._id.toString(),
      subtotal: pricing.subtotal,
    });
    const reserved = await reserveCoupon(coupon._id.toString());
    if (!reserved) throw AppError.badRequest('This coupon has reached its usage limit', 'COUPON_EXHAUSTED');
    appliedCoupon = { id: coupon._id.toString(), discount };
    pricing.discount = discount;
    pricing.total = Math.max(0, pricing.subtotal + pricing.taxTotal + pricing.serviceCharge - discount);
  }

  const estimatedPrepMinutes = Math.max(0, ...menuItems.map((m) => m.prepTimeMinutes), 0);

  // Opaque access token: raw goes to the guest once, only the hash is stored.
  const { raw: guestAccessToken, hash: guestAccessTokenHash } = generateSecureToken();
  const email = normalizeEmail(input.guest.email);

  let order: IOrder | null = null;
  for (let attempt = 0; attempt < 3 && !order; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      order = await Order.create({
        orderNumber: generateOrderNumber(),
        kitchen: kitchen._id,
        room: room._id,
        roomSnapshot: { roomNumber: room.roomNumber, floor: room.floor },
        guestInfo: {
          name: input.guest.name,
          email,
          phone: input.guest.phone,
          phoneNormalized: normalizePhone(input.guest.phone),
        },
        linkedToAccount: false,
        guestAccessTokenHash,
        items: pricing.items,
        pricing: { ...pricing, currency: 'INR' },
        coupon: appliedCoupon?.id,
        customerNote: input.customerNote,
        status: ORDER_STATUS.NEW_ORDER,
        statusHistory: [{ status: ORDER_STATUS.NEW_ORDER, at: new Date() }],
        payment: {
          method: input.paymentMethod,
          status: PAYMENT_STATUS.PENDING,
          amount: pricing.total,
          currency: 'INR',
        },
        refund: { status: REFUND_STATUS.NOT_REQUIRED, amount: 0 },
        estimatedPrepMinutes,
      });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000 && attempt < 2) continue;
      if (appliedCoupon) await releaseCoupon(appliedCoupon.id);
      throw err;
    }
  }
  if (!order) {
    if (appliedCoupon) await releaseCoupon(appliedCoupon.id);
    throw AppError.internal('Could not place order, please retry', 'ORDER_CREATE_FAILED');
  }

  // Decrement stock for the ordered items.
  for (const ci of input.items) {
    const item = byId.get(ci.menuItem);
    if (item && item.stockQuantity !== null) {
      item.stockQuantity = Math.max(0, item.stockQuantity - ci.quantity);
      if (item.stockQuantity === 0) item.inStock = false;
      // eslint-disable-next-line no-await-in-loop
      await item.save();
    }
  }

  // Confirmation email to the guest; kitchen/admin alerts for non-online orders
  // (Razorpay orders surface to the kitchen only once payment is verified).
  void notifications.notifyCustomerOrderReceived(order);
  if (input.paymentMethod !== PAYMENT_METHODS.RAZORPAY) {
    const payload = { orderId: order._id.toString(), orderNumber: order.orderNumber, status: order.status };
    emitToKitchen(kitchen._id.toString(), SOCKET_EVENTS.ORDER_NEW, payload);
    emitToAdmins(SOCKET_EVENTS.ORDER_NEW, payload);
    void notifications.notifyKitchenNewOrder(order);
  }

  return { order, guestAccessToken };
}

/** Resolve a guest order from its opaque access token (for pay/track). */
export async function getByGuestToken(token: string): Promise<IOrder> {
  const order = await Order.findOne({ guestAccessTokenHash: hashToken(token) });
  if (!order) throw AppError.notFound('Order not found');
  return order;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────
interface ListQuery {
  page?: number;
  limit?: number;
  status?: string;
  refundStatus?: string;
  kitchen?: string;
  from?: Date;
  to?: Date;
}

export async function listForCustomer(customerId: string, query: ListQuery) {
  const filter: FilterQuery<IOrder> = { customer: customerId };
  if (query.status) filter.status = query.status;
  return paginate(filter, query);
}

export async function getForCustomer(customerId: string, orderId: string) {
  const order = await Order.findById(orderId);
  if (!order || !order.customer || order.customer.toString() !== customerId) {
    throw AppError.notFound('Order not found');
  }
  return order;
}

export async function listForStaff(
  query: ListQuery & { scopeKitchenId?: string; isSuperAdmin: boolean },
) {
  const filter: FilterQuery<IOrder> = {};
  if (!query.isSuperAdmin) filter.kitchen = query.scopeKitchenId;
  else if (query.kitchen) filter.kitchen = query.kitchen;
  if (query.status) filter.status = query.status;
  if (query.refundStatus) filter['refund.status'] = query.refundStatus;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) (filter.createdAt as Record<string, Date>).$gte = query.from;
    if (query.to) (filter.createdAt as Record<string, Date>).$lte = query.to;
  }
  return paginate(filter, query);
}

async function paginate(filter: FilterQuery<IOrder>, query: ListQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Load an order for staff with internal notes, enforcing kitchen ownership. */
export async function getForStaff(orderId: string, scope: { isSuperAdmin: boolean; kitchenId?: string }) {
  const order = await Order.findById(orderId).select('+internalNotes');
  if (!order) throw AppError.notFound('Order not found');
  if (!scope.isSuperAdmin && order.kitchen.toString() !== scope.kitchenId) {
    throw AppError.forbidden('Order belongs to a different kitchen', 'CROSS_TENANT_DENIED');
  }
  return order;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────────────────────
export async function updateStatus(
  order: IOrder,
  next: OrderStatus,
  by: string,
  note?: string,
) {
  const allowed = ORDER_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(next)) {
    throw AppError.badRequest(
      `Cannot move an order from ${order.status} to ${next}`,
      'INVALID_TRANSITION',
    );
  }
  order.status = next;
  order.statusHistory.push({ status: next, at: new Date(), by: by as never, note });

  // COD/room-billing are settled on delivery.
  if (
    next === ORDER_STATUS.DELIVERED &&
    order.payment.method !== PAYMENT_METHODS.RAZORPAY &&
    order.payment.status === PAYMENT_STATUS.PENDING
  ) {
    order.payment.status = PAYMENT_STATUS.PAID;
    order.payment.paidAt = new Date();
  }
  // Rejecting an unpaid order needs no refund; a paid one is refunded in 4b.
  if (next === ORDER_STATUS.REJECTED) {
    order.refund.status =
      order.payment.status === PAYMENT_STATUS.PAID ? REFUND_STATUS.INITIATED : REFUND_STATUS.NOT_REQUIRED;
    if (order.payment.status === PAYMENT_STATUS.PAID) order.refund.amount = order.pricing.total;
  }

  await order.save();
  emitOrderUpdate(order);
  void notifications.notifyCustomerStatus(order);
  return order;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelOrder(order: IOrder, reason: string, by: string) {
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw AppError.conflict(`An order in status ${order.status} cannot be cancelled`, 'NOT_CANCELLABLE');
  }
  order.status = ORDER_STATUS.CANCELLED;
  order.statusHistory.push({ status: ORDER_STATUS.CANCELLED, at: new Date(), by: by as never, note: reason });
  order.cancellation = { scope: 'FULL', reason, cancelledBy: by as never, at: new Date() };

  if (order.payment.status === PAYMENT_STATUS.PAID) {
    order.refund.status = REFUND_STATUS.INITIATED;
    order.refund.amount = order.pricing.total;
    order.refund.reason = reason;
  } else {
    order.refund.status = REFUND_STATUS.NOT_REQUIRED;
  }

  await order.save();
  emitOrderUpdate(order, SOCKET_EVENTS.ORDER_CANCELLED);
  void notifications.notifyCustomerCancelled(order, reason);
  void notifications.notifyKitchenCancellation(order, reason);
  return order;
}

/**
 * Cancel specific item quantities. Recomputes line + order totals. If every item
 * ends up fully cancelled, the whole order is cancelled. Partial refunds are
 * marked INITIATED for paid orders (processed by the payments phase).
 */
export async function cancelItems(
  order: IOrder,
  cancellations: { menuItem: string; quantity: number }[],
  reason: string,
  by: string,
) {
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw AppError.conflict(`An order in status ${order.status} cannot be modified`, 'NOT_CANCELLABLE');
  }

  for (const c of cancellations) {
    const line = order.items.find((i: IOrderItem) => i.menuItem.toString() === c.menuItem);
    if (!line) throw AppError.badRequest(`Item ${c.menuItem} is not in this order`, 'ITEM_NOT_IN_ORDER');
    const remaining = line.quantity - line.cancelledQuantity;
    if (c.quantity > remaining) {
      throw AppError.badRequest(
        `Cannot cancel ${c.quantity} of "${line.name}" — only ${remaining} remain`,
        'CANCEL_QTY_EXCEEDS',
      );
    }
    line.cancelledQuantity += c.quantity;
    recomputeLine(line);
  }

  const fullyCancelled = order.items.every((i: IOrderItem) => i.cancelledQuantity >= i.quantity);
  const kitchen = await Kitchen.findById(order.kitchen).select('settings');
  const totals = recomputeOrderTotals(
    order.items,
    kitchen?.settings.serviceChargePercent ?? 0,
    order.pricing.discount,
  );

  const previousTotal = order.pricing.total;
  order.pricing.subtotal = totals.subtotal;
  order.pricing.taxTotal = totals.taxTotal;
  order.pricing.serviceCharge = totals.serviceCharge;
  order.pricing.total = totals.total;

  if (fullyCancelled) {
    order.status = ORDER_STATUS.CANCELLED;
    order.statusHistory.push({ status: ORDER_STATUS.CANCELLED, at: new Date(), by: by as never, note: reason });
    order.cancellation = { scope: 'FULL', reason, cancelledBy: by as never, at: new Date() };
  } else {
    order.cancellation = { scope: 'PARTIAL', reason, cancelledBy: by as never, at: new Date() };
  }

  // Refund the price delta for paid orders.
  if (order.payment.status === PAYMENT_STATUS.PAID) {
    const refundDelta = Math.max(0, previousTotal - order.pricing.total);
    order.refund.status = refundDelta > 0 ? REFUND_STATUS.INITIATED : order.refund.status;
    order.refund.amount = (order.refund.amount ?? 0) + refundDelta;
    order.refund.reason = reason;
  }

  await order.save();
  emitOrderUpdate(order);
  if (fullyCancelled) {
    void notifications.notifyCustomerCancelled(order, reason);
    void notifications.notifyKitchenCancellation(order, reason);
  }
  return order;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal notes (staff-only)
// ─────────────────────────────────────────────────────────────────────────────
export async function addInternalNote(
  order: IOrder,
  note: string,
  noteType: 'PREPARATION' | 'CUSTOMER_HANDLING' | 'REMARK',
  by: string,
) {
  order.internalNotes.push({ note, noteType, by: by as never, at: new Date() });
  await order.save();
  return order;
}

/** Kitchen Owner or Admin requests a refund for a paid order. */
export async function requestRefund(order: IOrder, reason: string, by: string) {
  if (order.payment.status !== PAYMENT_STATUS.PAID) {
    throw AppError.badRequest('Only paid orders can be refunded', 'NOT_PAID');
  }
  if (
    order.refund.status === REFUND_STATUS.REFUNDED ||
    order.refund.status === REFUND_STATUS.PROCESSING ||
    order.refund.status === REFUND_STATUS.INITIATED
  ) {
    throw AppError.conflict('A refund is already processed or in progress', 'REFUND_IN_PROGRESS');
  }

  order.refund.status = REFUND_STATUS.REQUESTED;
  order.refund.amount = order.pricing.total;
  order.refund.reason = reason;
  order.statusHistory.push({
    status: order.status,
    at: new Date(),
    by: by as never,
    note: `Refund requested: ${reason}`,
  });

  await order.save();
  emitOrderUpdate(order, SOCKET_EVENTS.REFUND_UPDATED);
  return order;
}

/** Admin approves the refund, setting status to INITIATED and processing it via Razorpay or offline. */
export async function approveRefund(order: IOrder, by: string) {
  if (order.refund.status !== REFUND_STATUS.REQUESTED) {
    throw AppError.badRequest('No pending refund request found for this order', 'NO_REFUND_REQUEST');
  }

  order.refund.status = REFUND_STATUS.INITIATED;
  order.statusHistory.push({
    status: order.status,
    at: new Date(),
    by: by as never,
    note: 'Refund request approved',
  });

  await order.save();
  return processRefund(order);
}

/** Admin rejects the refund request. */
export async function rejectRefund(order: IOrder, reason: string, by: string) {
  if (order.refund.status !== REFUND_STATUS.REQUESTED) {
    throw AppError.badRequest('No pending refund request found for this order', 'NO_REFUND_REQUEST');
  }

  order.refund.status = REFUND_STATUS.NOT_REQUIRED;
  order.statusHistory.push({
    status: order.status,
    at: new Date(),
    by: by as never,
    note: `Refund request rejected: ${reason}`,
  });

  await order.save();
  emitOrderUpdate(order, SOCKET_EVENTS.REFUND_UPDATED);
  return order;
}

function emitOrderUpdate(order: IOrder, event: string = SOCKET_EVENTS.ORDER_UPDATED) {
  const payload = {
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
  };
  if (order.customer) emitToUser(order.customer.toString(), event, payload);
  emitToKitchen(order.kitchen.toString(), event, payload);
  emitToAdmins(event, payload);
}
