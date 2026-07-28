import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const addItemSchema = z.object({
  room: objectId.optional(),
  table: objectId.optional(),
  menuItem: objectId,
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  note: z.string().trim().max(300).optional(),
}).refine(data => data.room || data.table, {
  message: "Either room or table must be provided",
  path: ["room", "table"]
});

export const updateItemSchema = z.object({
  /** 0 removes the line. */
  quantity: z.coerce.number().int().min(0).max(99),
  note: z.string().trim().max(300).optional(),
});

export const cartNoteSchema = z.object({
  customerNote: z.string().trim().max(500),
});

export const kitchenParam = z.object({ kitchenId: objectId });
export const itemParams = z.object({ kitchenId: objectId, menuItemId: objectId });
