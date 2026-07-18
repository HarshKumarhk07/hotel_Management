import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const createHallSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  pricePerHour: z.number().min(0, 'Price per hour must be non-negative'),
  pricePerPlate: z.number().min(0, 'Price per plate must be non-negative').optional(),
  isActive: z.boolean().optional(),
  kitchenId: objectId.optional(),
});

export const updateHallSchema = createHallSchema.partial();

export const createBookingSchema = z.object({
  hallId: objectId,
  guestName: z.string().trim().min(1, 'Guest name is required'),
  phone: z.string().trim().min(1, 'Phone is required'),
  email: z.string().trim().email('Valid email is required'),
  eventDate: z.coerce.date(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  guestCount: z.number().min(1, 'Guest count must be at least 1'),
  eventType: z.string().trim().min(1, 'Event type is required'),
  menuPreset: z.string().trim().optional(),
  paymentStatus: z.enum(['PENDING', 'PAID']).optional(),
});

export const updateBookingSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID']).optional(),
});
