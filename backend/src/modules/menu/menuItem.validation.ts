import { z } from 'zod';
import { ALL_FOOD_LABELS } from '@/constants';
import { paginationSchema } from '@/utils/pagination';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (24h)');

const windowSchema = z
  .object({
    days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    start: time,
    end: time,
  })
  .strict();

const availabilitySchema = z.object({
  scheduled: z.boolean().default(false),
  timezone: z.string().min(1).default('Asia/Kolkata'),
  windows: z.array(windowSchema).max(10).default([]),
});

export const createMenuItemSchema = z.object({
  kitchen: objectId.optional(), // required for SUPER_ADMIN
  category: objectId,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  price: z.coerce.number().min(0).max(1_000_000),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  prepTimeMinutes: z.coerce.number().int().min(0).max(600).optional(),
  foodLabel: z.enum(ALL_FOOD_LABELS as [string, ...string[]]).optional(),
  isFeatured: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  availability: availabilitySchema.optional(),
  stockQuantity: z.coerce.number().int().min(0).nullable().optional(),
});

export const updateMenuItemSchema = createMenuItemSchema
  .omit({ kitchen: true })
  .partial()
  .extend({
    inStock: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

export const listMenuItemsSchema = paginationSchema.extend({
  kitchen: objectId.optional(),
  category: objectId.optional(),
  foodLabel: z.enum(ALL_FOOD_LABELS as [string, ...string[]]).optional(),
  inStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  featured: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().trim().max(80).optional(),
});

export const menuItemIdParam = z.object({ id: objectId });

export const stockSchema = z.object({ inStock: z.boolean() });

export const publicMenuParam = z.object({ kitchenId: objectId });

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
