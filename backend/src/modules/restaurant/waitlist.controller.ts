import type { Request } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import * as service from './waitlist.service';

export const join = asyncHandler(async (req: Request, res) => {
  const waitlist = await service.joinWaitlist(req.body);
  return created(res, { waitlist });
});

export const status = asyncHandler(async (req: Request, res) => {
  const { phone, email } = req.query;
  const result = await service.checkWaitlistStatus({
    phone: phone as string,
    email: email as string,
  });
  return ok(res, result);
});

export const list = asyncHandler(async (req: Request, res) => {
  const waitlist = await service.listWaitlist(req.query as any);
  return ok(res, { waitlist });
});

export const seat = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const { tableId } = req.body;
  const waitlist = await service.seatWaitlistGuest(id, tableId);
  return ok(res, { waitlist });
});

export const cancel = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const waitlist = await service.cancelWaitlistEntry(id);
  return ok(res, { waitlist });
});

export const autoAssign = asyncHandler(async (_req, res) => {
  const assigned = await service.autoAssignTables();
  return ok(res, { assigned });
});
