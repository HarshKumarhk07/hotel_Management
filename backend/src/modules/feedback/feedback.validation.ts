import { z } from 'zod';

export const createFeedbackSchema = z.object({
  guestName: z.string().trim().min(1, 'Guest name is required'),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().trim().min(10, 'Valid phone number is required'),
  roomNumber: z.string().trim().optional(),
  category: z.enum(['ROOM', 'FOOD', 'VALET', 'GENERAL']),
  rating: z.number().min(1).max(5),
  comment: z.string().trim().min(1, 'Comment is required').max(1000),
});
