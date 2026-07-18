import { z } from 'zod';
import type { Request } from 'express';
import { Notification } from '@/models';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import { getPageParams, pageMeta, paginationSchema } from '@/utils/pagination';

export const listSchema = paginationSchema.extend({
  unread: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const idParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'),
});

/** List the current user's notifications (newest first), optionally unread-only. */
export const list = asyncHandler(async (req: Request, res) => {
  const { page, limit, skip } = getPageParams(req.query as never);
  const filter: Record<string, unknown> = { recipient: req.auth!.userId };
  if ((req.query as { unread?: boolean }).unread === true) filter.isRead = false;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.auth!.userId, isRead: false }),
  ]);
  return ok(res, { notifications: items, unreadCount }, 200, pageMeta(total, page, limit));
});

export const unreadCount = asyncHandler(async (req: Request, res) => {
  const count = await Notification.countDocuments({ recipient: req.auth!.userId, isRead: false });
  return ok(res, { unreadCount: count });
});

export const markRead = asyncHandler(async (req: Request, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.auth!.userId,
  });
  if (!notification) throw AppError.notFound('Notification not found');
  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }
  return ok(res, { notification });
});

export const markAllRead = asyncHandler(async (req: Request, res) => {
  const result = await Notification.updateMany(
    { recipient: req.auth!.userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
  return ok(res, { updated: result.modifiedCount });
});
