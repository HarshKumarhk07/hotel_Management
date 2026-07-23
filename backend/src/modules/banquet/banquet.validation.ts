import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const createHallSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  pricePerHour: z.number().min(0, 'Price per hour must be non-negative'),
  pricePerPlate: z.number().min(0, 'Price per plate must be non-negative').optional(),
  isActive: z.boolean().optional(),
  kitchenId: objectId.optional(),
  description: z.string().trim().max(500).optional(),
  area: z.string().trim().max(50).optional(),
  eventTypes: z.array(z.string().trim()).optional(),
  image: z.string().trim().optional(),
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
}).superRefine((data, ctx) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventDateVal = new Date(data.eventDate);
  eventDateVal.setHours(0, 0, 0, 0);

  if (eventDateVal < today) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Event date cannot be in the past',
      path: ['eventDate'],
    });
  }

  if (data.startTime >= data.endTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time must be after start time',
      path: ['endTime'],
    });
  }

  // Overnight booking: check if end date is same day or next day
  const startDay = new Date(data.startTime);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(data.endTime);
  endDay.setHours(0, 0, 0, 0);
  const diffDays = (endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time cannot be before start time',
      path: ['endTime'],
    });
  } else if (diffDays > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Overnight bookings can only extend to the next day',
      path: ['endTime'],
    });
  }
});

export const updateBookingSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  enquiryStatus: z.enum(['NEW', 'CONTACTED', 'CLOSED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID']).optional(),
});
