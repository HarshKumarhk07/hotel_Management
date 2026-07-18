import { z } from 'zod';
import { PASSWORD_POLICY } from '@/constants';
import { paginationSchema } from '@/utils/pagination';

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm 24-hour format');

const settings = z
  .object({
    serviceChargePercent: z.number().min(0).max(100).optional(),
    taxPercent: z.number().min(0).max(100).optional(),
    acceptsCOD: z.boolean().optional(),
    acceptsRoomBilling: z.boolean().optional(),
  })
  .optional();

const timings = z
  .object({
    open: time,
    close: time,
    timezone: z.string().min(1).default('Asia/Kolkata'),
  })
  .optional();

export const createKitchenSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().trim().min(6).max(20).optional(),
  timings,
  settings,
  /** Optionally provision the kitchen-owner account in the same call. */
  owner: z
    .object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().toLowerCase().email(),
      password: z
        .string()
        .min(PASSWORD_POLICY.minLength, PASSWORD_POLICY.message)
        .regex(PASSWORD_POLICY.regex, PASSWORD_POLICY.message),
    })
    .optional(),
});

export const updateKitchenSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().trim().min(6).max(20).optional(),
  timings,
  settings,
});

export const listKitchensSchema = paginationSchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().trim().max(120).optional(),
});

export const kitchenIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid kitchen id'),
});

export type CreateKitchenInput = z.infer<typeof createKitchenSchema>;
export type UpdateKitchenInput = z.infer<typeof updateKitchenSchema>;
