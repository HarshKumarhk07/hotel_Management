import type { Request } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, noContent } from '@/utils/apiResponse';
import * as service from './cart.service';

function customerId(req: Request): string {
  return req.auth!.userId;
}

export const addItem = asyncHandler(async (req: Request, res) => {
  const cart = await service.addItem(customerId(req), req.body);
  return ok(res, { cart }, 201);
});

export const getCart = asyncHandler(async (req: Request, res) => {
  const cart = await service.getCart(customerId(req), req.params.kitchenId);
  return ok(res, { cart });
});

export const updateItem = asyncHandler(async (req: Request, res) => {
  const cart = await service.updateItem(
    customerId(req),
    req.params.kitchenId,
    req.params.menuItemId,
    req.body.quantity,
    req.body.note,
  );
  return ok(res, { cart });
});

export const removeItem = asyncHandler(async (req: Request, res) => {
  const cart = await service.removeItem(customerId(req), req.params.kitchenId, req.params.menuItemId);
  return ok(res, { cart });
});

export const setNote = asyncHandler(async (req: Request, res) => {
  const cart = await service.setNote(customerId(req), req.params.kitchenId, req.body.customerNote);
  return ok(res, { cart });
});

export const clearCart = asyncHandler(async (req: Request, res) => {
  await service.clearCart(customerId(req), req.params.kitchenId);
  return noContent(res);
});
