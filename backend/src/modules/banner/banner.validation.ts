import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const createBannerSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  subtitle: z.string().trim().max(250).optional(),
  imageUrl: z.string().url('Invalid image URL format'),
  linkUrl: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  kitchenId: objectId.optional(),
});

export const updateBannerSchema = createBannerSchema.partial();
