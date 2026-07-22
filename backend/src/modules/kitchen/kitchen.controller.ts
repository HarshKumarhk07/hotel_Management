import type { Request } from 'express';
import { AUDIT_ACTIONS } from '@/constants';
import { Kitchen } from '@/models';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { auditFromRequest } from '@/services/audit.service';
import { assertKitchenAccess } from '@/utils/scope';
import { AppError } from '@/utils/AppError';
import { isKitchenAvailableNow } from '@/utils/availability';
import * as service from './kitchen.service';

/** Public: active kitchens (minimal fields) so the landing page can showcase one. */
export const listPublic = asyncHandler(async (_req: Request, res) => {
  const kitchens = await Kitchen.find({ isActive: true }).select('name slug temporarilyClosed timings weeklySchedule holidayTimings').sort({ createdAt: 1 });
  return ok(res, {
    kitchens: kitchens.map((k) => ({ 
      id: k._id.toString(), 
      name: k.name, 
      slug: k.slug,
      isOpen: isKitchenAvailableNow(k)
    })),
  });
});

export const create = asyncHandler(async (req: Request, res) => {
  const kitchen = await service.createKitchen(req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.KITCHEN_CREATED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `kitchen:${kitchen._id.toString()}`,
    metadata: { name: kitchen.name, ownerProvisioned: Boolean(req.body.owner) },
  });
  return created(res, { kitchen });
});

export const list = asyncHandler(async (req: Request, res) => {
  const { items, meta } = await service.listKitchens(req.query as never);
  return ok(res, { kitchens: items }, 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res) => {
  assertKitchenAccess(req, req.params.id);
  const kitchen = await service.getKitchen(req.params.id);
  return ok(res, { kitchen });
});

export const update = asyncHandler(async (req: Request, res) => {
  assertKitchenAccess(req, req.params.id);
  const kitchen = await service.updateKitchen(req.params.id, req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.KITCHEN_UPDATED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `kitchen:${kitchen._id.toString()}`,
  });
  return ok(res, { kitchen });
});

export const activate = asyncHandler(async (req: Request, res) => {
  const kitchen = await service.setKitchenActive(req.params.id, true);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.KITCHEN_ACTIVATED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `kitchen:${kitchen._id.toString()}`,
  });
  return ok(res, { kitchen });
});

export const deactivate = asyncHandler(async (req: Request, res) => {
  const kitchen = await service.setKitchenActive(req.params.id, false);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.KITCHEN_DEACTIVATED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `kitchen:${kitchen._id.toString()}`,
  });
  return ok(res, { kitchen });
});

export const getDashboard = asyncHandler(async (req: Request, res) => {
  const kitchenId = (req.auth!.role === 'SUPER_ADMIN' || req.query.kitchen)
    ? (req.query.kitchen as string)
    : req.auth!.kitchenId;

  if (!kitchenId) {
    throw AppError.badRequest('A kitchen id is required for this action', 'KITCHEN_REQUIRED');
  }

  // If kitchen owner, ensure they only request their own kitchen
  if (req.auth!.role === 'KITCHEN_OWNER' && kitchenId !== req.auth!.kitchenId) {
    throw AppError.forbidden('Resource belongs to a different kitchen', 'CROSS_TENANT_DENIED');
  }

  const data = await service.getKitchenDashboard(kitchenId);
  return ok(res, data);
});
