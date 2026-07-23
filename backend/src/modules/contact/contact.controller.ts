import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import { ContactMessage } from '@/models';

export const createMessage = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, subject, message } = req.body;
  
  const contactMsg = await ContactMessage.create({
    name,
    email,
    phone,
    subject,
    message,
  });

  return created(res, { message: 'Message sent successfully', contactMessage: contactMsg });
});

export const listContactMessages = asyncHandler(async (_req: Request, res: Response) => {
  const messages = await ContactMessage.find().sort({ createdAt: -1 });
  return ok(res, { messages });
});

export const getMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await ContactMessage.findById(req.params.id);
  if (!message) throw AppError.notFound('Message not found');
  return ok(res, { message });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const message = await ContactMessage.findById(req.params.id);
  if (!message) throw AppError.notFound('Message not found');
  
  message.isRead = true;
  await message.save();
  return ok(res, { message });
});

export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await ContactMessage.findById(req.params.id);
  if (!message) throw AppError.notFound('Message not found');
  
  await message.deleteOne();
  return ok(res, { message: 'Message deleted successfully' });
});
