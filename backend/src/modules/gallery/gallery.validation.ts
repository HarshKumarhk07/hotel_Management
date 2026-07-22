import { z } from 'zod';

export const createGalleryImageSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional(),
  category: z.string().optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateGalleryImageSchema = createGalleryImageSchema.partial();
