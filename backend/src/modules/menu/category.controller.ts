import type { Request } from 'express';
import { AUDIT_ACTIONS } from '@/constants';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created, noContent } from '@/utils/apiResponse';
import { auditFromRequest } from '@/services/audit.service';
import { assertKitchenAccess, resolveKitchenScope } from '@/utils/scope';
import * as service from './category.service';

export const create = asyncHandler(async (req: Request, res) => {
  const kitchenId = resolveKitchenScope(req, req.body.kitchen);
  const category = await service.createCategory(kitchenId, req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.CATEGORY_CREATED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `category:${category._id.toString()}`,
    metadata: { kitchen: kitchenId, name: category.name },
  });
  return created(res, { category });
});

export const list = asyncHandler(async (req: Request, res) => {
  const kitchenId = resolveKitchenScope(req, req.query.kitchen as string | undefined);
  const categories = await service.listCategories(kitchenId, req.query.isActive as never);
  return ok(res, { categories });
});

export const getOne = asyncHandler(async (req: Request, res) => {
  const category = await service.getCategory(req.params.id);
  assertKitchenAccess(req, category.kitchen.toString());
  return ok(res, { category });
});

export const update = asyncHandler(async (req: Request, res) => {
  const existing = await service.getCategory(req.params.id);
  assertKitchenAccess(req, existing.kitchen.toString());
  const category = await service.updateCategory(req.params.id, req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.CATEGORY_UPDATED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `category:${category._id.toString()}`,
  });
  return ok(res, { category });
});

export const remove = asyncHandler(async (req: Request, res) => {
  const existing = await service.getCategory(req.params.id);
  assertKitchenAccess(req, existing.kitchen.toString());
  await service.deleteCategory(req.params.id);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.CATEGORY_DELETED,
    actor: req.auth!.userId,
    role: req.auth!.role,
    target: `category:${req.params.id}`,
  });
  return noContent(res);
});
