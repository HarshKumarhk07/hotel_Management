import { z } from 'zod';
import { ORDER_STATUS, PAYMENT_METHODS } from '@/constants';
import { paginationSchema } from '@/utils/pagination';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const checkoutSchema = z.object({
  kitchen: objectId,
  paymentMethod: z.enum([
    PAYMENT_METHODS.RAZORPAY,
    PAYMENT_METHODS.COD,
    PAYMENT_METHODS.ROOM_BILLING,
  ]),
  customerNote: z.string().trim().max(500).optional(),
  couponCode: z.string().trim().min(3).max(30).optional(),
});

export const orderIdParam = z.object({ id: objectId });

/** Guest checkout — items come in the request (no server cart); contact required. */
export const guestCheckoutSchema = z.object({
  kitchen: objectId,
  room: objectId,
  items: z
    .array(
      z.object({
        menuItem: objectId,
        quantity: z.coerce.number().int().min(1).max(99),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .min(1, 'Add at least one item'),
  guest: z.object({
    name: z.string().trim().min(2, 'Name is too short').max(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    phone: z
      .string()
      .trim()
      .max(20)
      .refine((v) => v.replace(/\D/g, '').length >= 10, 'Enter a valid phone number'),
  }),
  paymentMethod: z.enum([
    PAYMENT_METHODS.RAZORPAY,
    PAYMENT_METHODS.COD,
    PAYMENT_METHODS.ROOM_BILLING,
  ]),
  customerNote: z.string().trim().max(500).optional(),
  couponCode: z.string().trim().min(3).max(30).optional(),
});

/** Opaque guest access token (hex from a 32-byte secret = 64 chars). */
export const guestTokenParam = z.object({ token: z.string().min(32).max(200) });

export type GuestCheckoutBody = z.infer<typeof guestCheckoutSchema>;

export const listOrdersSchema = paginationSchema.extend({
  status: z.enum(Object.values(ORDER_STATUS) as [string, ...string[]]).optional(),
  refundStatus: z.string().optional(),
  kitchen: objectId.optional(), // Super Admin filter
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/** Forward status transitions only (cancellation has its own endpoint). */
export const updateStatusSchema = z.object({
  status: z.enum([
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.PREPARING,
    ORDER_STATUS.READY,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.REJECTED,
  ]),
  note: z.string().trim().max(300).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const cancelItemsSchema = z.object({
  reason: z.string().trim().min(3).max(300),
  items: z
    .array(
      z.object({
        menuItem: objectId,
        quantity: z.coerce.number().int().min(1).max(99),
      }),
    )
    .min(1),
});

export const internalNoteSchema = z.object({
  note: z.string().trim().min(1).max(500),
  noteType: z.enum(['PREPARATION', 'CUSTOMER_HANDLING', 'REMARK']).default('REMARK'),
});

export const refundRequestSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
