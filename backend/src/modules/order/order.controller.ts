import type { Request } from 'express';
import { AUDIT_ACTIONS, ROLES, type OrderStatus } from '@/constants';
import { User } from '@/models';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import { auditFromRequest } from '@/services/audit.service';
import { linkGuestOrders } from '@/services/orderLinking.service';
import * as service from './order.service';

function staffScope(req: Request) {
  return {
    isSuperAdmin: req.auth!.role === ROLES.SUPER_ADMIN,
    kitchenId: req.auth!.kitchenId,
  };
}

// ── Guest (no authentication) ──
export const guestCheckout = asyncHandler(async (req: Request, res) => {
  const { order, guestAccessToken } = await service.guestCheckout(req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.GUEST_ORDER_PLACED,
    actorEmail: order.guestInfo?.email,
    target: `order:${order._id.toString()}`,
    metadata: {
      orderNumber: order.orderNumber,
      total: order.pricing.total,
      coupon: order.coupon?.toString(),
    },
  });
  // The access token is returned ONCE here — the guest stores it to pay/track.
  return created(res, { order: service.toCustomerView(order), guestAccessToken });
});

export const trackGuestOrder = asyncHandler(async (req: Request, res) => {
  const order = await service.getByGuestToken(req.params.token);
  return ok(res, { order: service.toCustomerView(order) });
});

// ── Authenticated: manually trigger linking of this account's guest orders ──
export const linkMyGuestOrders = asyncHandler(async (req: Request, res) => {
  const user = await User.findById(req.auth!.userId);
  if (!user) throw AppError.notFound('User not found');
  const { linked } = await linkGuestOrders(user, {
    ip: req.context?.ip,
    device: req.context?.device,
  });
  return ok(res, { linked });
});

// ── Customer ──
export const checkout = asyncHandler(async (req: Request, res) => {
  const order = await service.checkout(req.auth!.userId, req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.ORDER_PLACED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${order._id.toString()}`,
    metadata: {
      orderNumber: order.orderNumber,
      total: order.pricing.total,
      discount: order.pricing.discount,
      coupon: order.coupon?.toString(),
    },
  });
  return created(res, { order: service.toCustomerView(order) });
});

export const myOrders = asyncHandler(async (req: Request, res) => {
  const { items, meta } = await service.listForCustomer(req.auth!.userId, req.query as never);
  return ok(res, { orders: items.map(service.toCustomerView) }, 200, meta);
});

export const myOrder = asyncHandler(async (req: Request, res) => {
  const order = await service.getForCustomer(req.auth!.userId, req.params.id);
  return ok(res, { order: service.toCustomerView(order) });
});

// ── Staff (Kitchen Owner / Super Admin) ──
export const staffList = asyncHandler(async (req: Request, res) => {
  const { items, meta } = await service.listForStaff({
    ...(req.query as unknown as Record<string, unknown>),
    scopeKitchenId: staffScope(req).kitchenId,
    isSuperAdmin: staffScope(req).isSuperAdmin,
  });
  return ok(res, { orders: items }, 200, meta);
});

export const staffGet = asyncHandler(async (req: Request, res) => {
  const order = await service.getForStaff(req.params.id, staffScope(req));
  return ok(res, { order });
});

export const updateStatus = asyncHandler(async (req: Request, res) => {
  const order = await service.getForStaff(req.params.id, staffScope(req));
  const updated = await service.updateStatus(
    order,
    req.body.status as OrderStatus,
    req.auth!.userId,
    req.body.note,
  );
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${updated._id.toString()}`,
    metadata: { status: updated.status },
  });
  return ok(res, { order: updated });
});

export const cancelOrder = asyncHandler(async (req: Request, res) => {
  const order = await service.getForStaff(req.params.id, staffScope(req));
  const updated = await service.cancelOrder(order, req.body.reason, req.auth!.userId);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.ORDER_CANCELLED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${updated._id.toString()}`,
    metadata: { reason: req.body.reason, refund: updated.refund.status },
  });
  return ok(res, { order: updated });
});

export const cancelItems = asyncHandler(async (req: Request, res) => {
  const order = await service.getForStaff(req.params.id, staffScope(req));
  const updated = await service.cancelItems(order, req.body.items, req.body.reason, req.auth!.userId);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.ORDER_ITEM_CANCELLED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${updated._id.toString()}`,
    metadata: { items: req.body.items, refund: updated.refund.status },
  });
  return ok(res, { order: updated });
});

export const addNote = asyncHandler(async (req: Request, res) => {
  const order = await service.getForStaff(req.params.id, staffScope(req));
  const updated = await service.addInternalNote(order, req.body.note, req.body.noteType, req.auth!.userId);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.ORDER_NOTE_ADDED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${updated._id.toString()}`,
  });
  return ok(res, { order: updated });
});

export const requestRefund = asyncHandler(async (req: Request, res) => {
  const order = await service.getForStaff(req.params.id, staffScope(req));
  const updated = await service.requestRefund(order, req.body.reason, req.auth!.userId);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.REFUND_PROCESSED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${updated._id.toString()}`,
    metadata: { reason: req.body.reason, status: updated.refund.status },
  });
  return ok(res, { order: updated });
});

export const approveRefund = asyncHandler(async (req: Request, res) => {
  const order = await service.getForStaff(req.params.id, staffScope(req));
  const updated = await service.approveRefund(order, req.auth!.userId);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.REFUND_PROCESSED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${updated._id.toString()}`,
    metadata: { approved: true, status: updated.refund.status },
  });
  return ok(res, { order: updated });
});

export const rejectRefund = asyncHandler(async (req: Request, res) => {
  const order = await service.getForStaff(req.params.id, staffScope(req));
  const updated = await service.rejectRefund(order, req.body.reason, req.auth!.userId);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.REFUND_PROCESSED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `order:${updated._id.toString()}`,
    metadata: { approved: false, reason: req.body.reason, status: updated.refund.status },
  });
  return ok(res, { order: updated });
});

export const downloadInvoice = asyncHandler(async (req: Request, res) => {
  // Let's get the order. We can try to get it for staff or check if it's customer
  let order;
  try {
    order = await service.getForStaff(req.params.id, staffScope(req));
  } catch (err) {
    // If not staff, check if it's the customer's own order
    order = await service.getForCustomer(req.auth!.userId, req.params.id);
  }

  if (!order) throw AppError.notFound('Order not found');

  const { generateInvoiceHtml } = await import('@/services/invoice.service');
  const html = await generateInvoiceHtml(order);
  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
});

