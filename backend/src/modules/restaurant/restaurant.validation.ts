import { z } from 'zod';
import { ALL_RESERVATION_STATUSES, RESERVATION_STATUS } from '@/constants';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');

export const createTableSchema = z.object({
  number:    z.string().trim().min(1).max(20),
  floor:     z.number().int().min(0).default(0),
  section:   z.string().trim().max(60).optional(),
  capacity:  z.number().int().min(1).max(50),
  kitchenId: mongoId,
});

export const updateTableSchema = z.object({
  number:    z.string().trim().min(1).max(20).optional(),
  floor:     z.number().int().min(0).optional(),
  section:   z.string().trim().max(60).optional(),
  capacity:  z.number().int().min(1).max(50).optional(),
  isActive:  z.boolean().optional(),
});

export const seatTableSchema = z.object({
  partySize:     z.number().int().min(1),
  guestName:     z.string().trim().max(120).optional(),
  phone:         z.string().trim().optional(),
  reservationId: mongoId.optional(),
  notes:         z.string().trim().max(300).optional(),
});

export const createReservationSchema = z.object({
  guestName:   z.string().trim().min(1).max(120),
  phone:       z.string().trim().min(1),
  email:       z.string().trim().email().optional(),
  partySize:   z.number().int().min(1).max(50),
  scheduledAt: z.string().datetime({ offset: true }),
  durationMins:z.number().int().min(30).default(90),
  notes:       z.string().trim().max(300).optional(),
});

export const updateReservationSchema = z.object({
  status: z.enum(ALL_RESERVATION_STATUSES as [string, ...string[]]),
  cancelReason: z.string().trim().max(300).optional(),
}).refine(
  (d) => d.status !== RESERVATION_STATUS.CANCELLED || !!d.cancelReason,
  { message: 'cancelReason is required when cancelling', path: ['cancelReason'] },
);

// Waitlist Validation
export const joinWaitlistSchema = z.object({
  guestName: z.string().trim().min(1, 'Name is required').max(100),
  phone: z.string().trim().min(5, 'Valid phone is required').max(20),
  email: z.string().email('Valid email is required'),
  guestsCount: z.number().int().min(1, 'Party size must be at least 1'),
});

export const checkWaitlistSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
});

export const seatWaitlistSchema = z.object({
  tableId: mongoId,
});
