import { z } from 'zod';
import { paginationSchema } from '@/utils/pagination';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const createRoomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(20),
  floor: z.coerce.number().int().min(-5).max(200),
  kitchen: objectId.optional(),
  internalNote: z.string().trim().max(500).optional(),
});

export const updateRoomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(20).optional(),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  kitchen: objectId.nullable().optional(),
  internalNote: z.string().trim().max(500).optional(),
});

export const listRoomsSchema = paginationSchema.extend({
  floor: z.coerce.number().int().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  qrActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().trim().max(40).optional(),
});

export const roomIdParam = z.object({ id: objectId });

export const qrFormatQuery = z.object({
  format: z.enum(['png', 'svg', 'dataurl']).default('png'),
  size: z.coerce.number().int().min(128).max(2048).optional(),
});

/** Reassign this room's QR token to a different target room. */
export const reassignQrSchema = z.object({
  targetRoomId: objectId,
});

export const scanTokenParam = z.object({
  token: z.string().min(8).max(64),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;

// Room Booking validation schemas
export const searchRoomsSchema = z.object({
  checkInDate: z.string().datetime({ precision: 3, offset: true }),
  checkOutDate: z.string().datetime({ precision: 3, offset: true }),
  floor: z.coerce.number().int().optional(),
});

export const createBookingSchema = z.object({
  room: objectId,
  guestName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(20),
  email: z.string().email(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']),
});

export const setRoomStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE']),
});

