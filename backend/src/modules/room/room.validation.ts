import { z } from 'zod';
import { paginationSchema } from '@/utils/pagination';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const createRoomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(20),
  floor: z.coerce.number().int().min(-5).max(200),
  kitchen: objectId.optional(),
  // Required: a room may only ever be created against a real Room Category.
  roomType: z.string().trim().min(1, 'A room category is required').max(50),
  internalNote: z.string().trim().max(500).optional(),
});

export const updateRoomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(20).optional(),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  kitchen: objectId.nullable().optional(),
  roomType: z.string().trim().min(1).max(50).optional(),
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
  checkInDate: z.string().min(1),
  checkOutDate: z.string().min(1),
  floor: z.coerce.number().int().optional(),
  roomType: z.string().trim().min(1).max(50).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  guestCount: z.coerce.number().int().min(1).optional(),
});

/**
 * Every guest-registration field the front desk needs at check-in is mandatory
 * here — the backend is the authority, so a booking can never be created with a
 * missing address or unverifiable ID even if the form is bypassed.
 */
export const createBookingSchema = z.object({
  room: objectId,
  guestName: z
    .string()
    .trim()
    .min(2, 'Guest full name is required')
    .max(100, 'Guest name is too long'),
  phone: z
    .string()
    .trim()
    .min(10, 'A valid phone number is required')
    .max(20, 'Phone number is too long')
    .regex(/^[+\d][\d\s\-()]{8,}$/, 'Enter a valid phone number'),
  email: z.string().trim().email('A valid email address is required'),
  checkInDate: z.string().min(1, 'Check-in date is required'),
  checkOutDate: z.string().min(1, 'Check-out date is required'),
  address: z
    .string()
    .trim()
    .min(5, 'Street address is required')
    .max(200, 'Street address is too long'),
  city: z.string().trim().min(2, 'City is required').max(100, 'City name is too long'),
  country: z.string().trim().min(2, 'Country is required').max(100, 'Country name is too long'),
  governmentId: z
    .string()
    .trim()
    .min(4, 'Government ID number is required')
    .max(40, 'Government ID number is too long'),
  idProofUrl: z.string().trim().url('An uploaded government ID proof document is required'),
  idProofType: z.enum(['Aadhaar', 'Passport', 'Driving License', 'Voter ID', 'Other'], {
    errorMap: () => ({ message: 'Select a valid government ID type' }),
  }),
  specialRequests: z
    .object({
      lateCheckIn: z.boolean().default(false),
      extraBed: z.boolean().default(false),
      airportPickup: z.boolean().default(false),
      note: z.string().trim().max(500, 'Special instructions are too long').optional(),
    })
    .optional(),
  couponCode: z.string().trim().max(40).optional(),
  paymentMethod: z.enum(['RAZORPAY', 'CASH']).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  confirmationNumber: z.string().trim().max(40).optional(),
});

export const transferRoomSchema = z.object({
  newRoomId: objectId,
});

export const recordPaymentSchema = z.object({
  status: z.enum(['PAID', 'PENDING']),
  method: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(120).optional(),
});

export const migrateCategorySchema = z.object({
  toRoomType: z.string().trim().min(1, 'A target room category is required').max(50),
  fromRoomType: z.string().trim().min(1).max(50).optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']),
});

export const setRoomStatusSchema = z.object({
  status: z.enum([
    'AVAILABLE',
    'RESERVED',
    'OCCUPIED',
    'CLEANING',
    'MAINTENANCE',
    'BLOCKED',
    'OUT_OF_SERVICE',
    'VIP_RESERVED',
  ]),
});

export const createCategorySchema = z.object({
  roomType: z.string().trim().min(1).max(50),
  displayName: z.string().trim().min(1).max(50),
  description: z.string().trim().max(500).optional(),
  pricePerNight: z.coerce.number().min(0),
  capacity: z.coerce.number().int().min(1).optional(),
  amenities: z.array(z.string().trim().min(1)).optional(),
  images: z.array(z.string().url()).optional(),
});

export const updateCategorySchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(500).optional(),
  pricePerNight: z.coerce.number().min(0).optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  amenities: z.array(z.string().trim().min(1)).optional(),
  images: z.array(z.string().url()).optional(),
});

export const categoryIdParam = z.object({ id: objectId });
