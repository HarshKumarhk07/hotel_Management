import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const orderIdParam = z.object({ orderId: objectId });

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(5),
  razorpayPaymentId: z.string().min(5),
  razorpaySignature: z.string().min(10),
});

export const failedPaymentSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const refundSchema = z.object({
  /** Optional override note recorded on the refund. */
  reason: z.string().trim().max(300).optional(),
});

// ── Guest payment (authenticated by the opaque order access token) ──
const guestToken = z.string().min(32).max(200);

export const guestRazorpaySchema = z.object({ token: guestToken });

export const guestVerifySchema = verifyPaymentSchema.extend({ token: guestToken });
