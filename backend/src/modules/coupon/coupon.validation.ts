import { z } from 'zod';
import { DISCOUNT_TYPES } from '@/constants';
import { paginationSchema } from '@/utils/pagination';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const createCouponSchema = z
  .object({
    code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric'),
    description: z.string().trim().max(300).optional(),
    discountType: z.enum([DISCOUNT_TYPES.FIXED, DISCOUNT_TYPES.PERCENT]),
    discountValue: z.coerce.number().positive(),
    maxDiscount: z.coerce.number().positive().optional(),
    minOrderValue: z.coerce.number().min(0).optional(),
    usageLimit: z.coerce.number().int().positive().optional(),
    perUserLimit: z.coerce.number().int().positive().optional(),
    startsAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    kitchen: objectId.optional(),
  })
  .refine((d) => d.discountType !== DISCOUNT_TYPES.PERCENT || d.discountValue <= 100, {
    message: 'Percentage discount cannot exceed 100',
    path: ['discountValue'],
  });

export const updateCouponSchema = z.object({
  description: z.string().trim().max(300).optional(),
  discountValue: z.coerce.number().positive().optional(),
  maxDiscount: z.coerce.number().positive().optional(),
  minOrderValue: z.coerce.number().min(0).optional(),
  usageLimit: z.coerce.number().int().positive().optional(),
  perUserLimit: z.coerce.number().int().positive().optional(),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const listCouponsSchema = paginationSchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  kitchen: objectId.optional(),
});

export const couponIdParam = z.object({ id: objectId });

export const validateCouponSchema = z.object({
  code: z.string().trim().min(3).max(30),
  kitchen: objectId,
  subtotal: z.coerce.number().min(0),
});
