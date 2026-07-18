import type { Request } from 'express';
import { AUDIT_ACTIONS } from '@/constants';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created, noContent } from '@/utils/apiResponse';
import { auditFromRequest } from '@/services/audit.service';
import { assertKitchenAccess, resolveKitchenScope } from '@/utils/scope';
import { AppError } from '@/utils/AppError';
import * as service from './menuItem.service';

function actor(req: Request) {
  return { actor: req.auth!.userId, role: req.auth!.role };
}

export const create = asyncHandler(async (req: Request, res) => {
  const kitchenId = resolveKitchenScope(req, req.body.kitchen);
  const item = await service.createMenuItem(kitchenId, req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.MENU_ITEM_CREATED,
    ...actor(req),
    target: `menuItem:${item._id.toString()}`,
    metadata: { kitchen: kitchenId, name: item.name },
  });
  return created(res, { item });
});

export const list = asyncHandler(async (req: Request, res) => {
  const kitchenId = resolveKitchenScope(req, req.query.kitchen as string | undefined);
  const { items, meta } = await service.listMenuItems({
    ...(req.query as unknown as Record<string, unknown>),
    kitchen: kitchenId,
  });
  return ok(res, { items }, 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res) => {
  const item = await service.getMenuItem(req.params.id);
  assertKitchenAccess(req, item.kitchen.toString());
  return ok(res, { item });
});

export const update = asyncHandler(async (req: Request, res) => {
  const existing = await service.getMenuItem(req.params.id);
  assertKitchenAccess(req, existing.kitchen.toString());
  const item = await service.updateMenuItem(req.params.id, req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.MENU_ITEM_UPDATED,
    ...actor(req),
    target: `menuItem:${item._id.toString()}`,
  });
  return ok(res, { item });
});

export const remove = asyncHandler(async (req: Request, res) => {
  const existing = await service.getMenuItem(req.params.id);
  assertKitchenAccess(req, existing.kitchen.toString());
  await service.deleteMenuItem(req.params.id);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.MENU_ITEM_DELETED,
    ...actor(req),
    target: `menuItem:${req.params.id}`,
  });
  return noContent(res);
});

export const setStock = asyncHandler(async (req: Request, res) => {
  const existing = await service.getMenuItem(req.params.id);
  assertKitchenAccess(req, existing.kitchen.toString());
  const item = await service.setStock(req.params.id, req.body.inStock);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.MENU_STOCK_CHANGED,
    ...actor(req),
    target: `menuItem:${item._id.toString()}`,
    metadata: { inStock: item.inStock },
  });
  return ok(res, { item });
});

export const uploadImage = asyncHandler(async (req: Request, res) => {
  const existing = await service.getMenuItem(req.params.id);
  assertKitchenAccess(req, existing.kitchen.toString());
  if (!req.file) throw AppError.badRequest('No image file provided', 'NO_FILE');
  const item = await service.setImage(req.params.id, req.file.buffer);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.MENU_IMAGE_UPDATED,
    ...actor(req),
    target: `menuItem:${item._id.toString()}`,
  });
  return ok(res, { item });
});

export const removeImage = asyncHandler(async (req: Request, res) => {
  const existing = await service.getMenuItem(req.params.id);
  assertKitchenAccess(req, existing.kitchen.toString());
  const item = await service.removeImage(req.params.id);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.MENU_IMAGE_UPDATED,
    ...actor(req),
    target: `menuItem:${item._id.toString()}`,
    metadata: { removed: true },
  });
  return ok(res, { item });
});

export const bulkStock = asyncHandler(async (req: Request, res) => {
  const updates = req.body.updates;
  if (!Array.isArray(updates)) {
    throw AppError.badRequest('Updates list must be an array', 'INVALID_UPDATES');
  }

  for (const update of updates) {
    const item = await service.getMenuItem(update.id);
    assertKitchenAccess(req, item.kitchen.toString());
  }

  const items = await service.bulkUpdateStock(updates);
  return ok(res, { items });
});

/** Public: full orderable menu for a kitchen (used after a QR scan). */
export const publicMenu = asyncHandler(async (req: Request, res) => {
  const data = await service.getPublicMenu(req.params.kitchenId);
  return ok(res, data);
});
