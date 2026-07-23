import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const createComplaintSchema = z.object({
  roomId: objectId,
  guestName: z.string().trim().min(1, 'Guest name is required'),
  phone: z.string().trim().min(10, 'Valid phone number is required'),
  email: z.string().email('Valid email is required').optional(),
  category: z.enum(['HOUSEKEEPING', 'MAINTENANCE', 'ROOM_SERVICE', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  description: z.string().trim().min(1, 'Description is required').max(1000),
});

export const updateComplaintSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']).optional(),
  assignedStaff: objectId.optional().nullable(),
  staffNotes: z.string().trim().max(1000).optional(),
});
