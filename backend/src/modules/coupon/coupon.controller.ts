import type { Request } from 'express';
import { AUDIT_ACTIONS } from '@/constants';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created, noContent } from '@/utils/apiResponse';
import { auditFromRequest } from '@/services/audit.service';
import * as service from './coupon.service';

export const create = asyncHandler(async (req: Request, res) => {
  const coupon = await service.createCoupon(req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.COUPON_CREATED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `coupon:${coupon._id.toString()}`,
    metadata: { code: coupon.code },
  });
  return created(res, { coupon });
});

export const list = asyncHandler(async (req: Request, res) => {
  const { items, meta } = await service.listCoupons(req.query as never);
  return ok(res, { coupons: items }, 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res) => {
  const coupon = await service.getCoupon(req.params.id);
  return ok(res, { coupon });
});

export const update = asyncHandler(async (req: Request, res) => {
  const coupon = await service.updateCoupon(req.params.id, req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.COUPON_UPDATED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `coupon:${coupon._id.toString()}`,
  });
  return ok(res, { coupon });
});

export const remove = asyncHandler(async (req: Request, res) => {
  await service.deleteCoupon(req.params.id);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.COUPON_DELETED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `coupon:${req.params.id}`,
  });
  return noContent(res);
});

/** Customer: preview a coupon's discount for a kitchen + cart subtotal. */
export const validate = asyncHandler(async (req: Request, res) => {
  const { coupon, discount } = await service.validateCoupon(req.body.code, {
    userId: req.auth!.userId,
    kitchenId: req.body.kitchen,
    subtotal: req.body.subtotal,
  });
  return ok(res, {
    valid: true,
    code: coupon.code,
    discountType: coupon.discountType,
    discount,
  });
});
