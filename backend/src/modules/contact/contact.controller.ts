import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import { ContactMessage, type IContactMessage } from '@/models';
import { getPageParams, pageMeta } from '@/utils/pagination';
import { emitToAdmins } from '@/realtime/emit';

/** Escape a user-supplied search term before using it in a $regex. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const createMessage = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, subject, message } = req.body;

  const contactMsg = await ContactMessage.create({
    name,
    email,
    phone,
    subject,
    message,
    isRead: false,
    status: 'UNREAD',
  });

  // Real-time alert so admins see a bell notification the moment a message arrives.
  emitToAdmins('contact:new', contactMsg);

  return created(res, { message: 'Message sent successfully', contactMessage: contactMsg });
});

/**
 * Admin inbox: newest first, searchable across name/email/phone/subject/message,
 * filterable by status and paginated.
 */
export const listContactMessages = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPageParams({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  const filter: FilterQuery<IContactMessage> = {};

  const status = req.query.status as string | undefined;
  if (status && ['UNREAD', 'READ', 'RESOLVED'].includes(status)) {
    filter.status = status as IContactMessage['status'];
  }

  const search = (req.query.search as string | undefined)?.trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { subject: rx }, { message: rx }];
  }

  const [items, total, unreadCount] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    ContactMessage.countDocuments(filter),
    ContactMessage.countDocuments({ status: 'UNREAD' }),
  ]);

  return ok(res, { messages: items, unreadCount }, 200, pageMeta(total, page, limit));
});

export const getMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await ContactMessage.findById(req.params.id);
  if (!message) throw AppError.notFound('Message not found');
  return ok(res, { message });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const message = await ContactMessage.findById(req.params.id);
  if (!message) throw AppError.notFound('Message not found');

  // A resolved message stays resolved — marking it read must not regress it.
  if (message.status !== 'RESOLVED') {
    message.status = 'READ';
  }
  message.isRead = true;
  await message.save();
  return ok(res, { message });
});

/** Move a message between UNREAD / READ / RESOLVED. */
export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status?: string };
  if (!status || !['UNREAD', 'READ', 'RESOLVED'].includes(status)) {
    throw AppError.badRequest('Status must be one of UNREAD, READ or RESOLVED', 'INVALID_STATUS');
  }

  const message = await ContactMessage.findById(req.params.id);
  if (!message) throw AppError.notFound('Message not found');

  message.status = status as IContactMessage['status'];
  message.isRead = status !== 'UNREAD';

  if (status === 'RESOLVED') {
    message.resolvedAt = new Date();
    message.resolvedBy = req.auth?.email;
  } else {
    message.resolvedAt = undefined;
    message.resolvedBy = undefined;
  }

  await message.save();
  return ok(res, { message });
});

export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await ContactMessage.findById(req.params.id);
  if (!message) throw AppError.notFound('Message not found');

  await message.deleteOne();
  return ok(res, { message: 'Message deleted successfully' });
});
