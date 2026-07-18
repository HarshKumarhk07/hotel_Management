import Razorpay from 'razorpay';
import { env } from './env';
import { AppError } from '@/utils/AppError';

/**
 * Lazily-constructed Razorpay client. Payment *creation* and *refunds* need the
 * SDK (and live keys); signature verification is pure HMAC and works with just
 * the secret, so those paths live in the payment service and stay testable
 * without network access.
 */
let client: Razorpay | null = null;

export function isRazorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

export function getRazorpay(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw AppError.badRequest('Online payments are not configured', 'PAYMENTS_DISABLED');
  }
  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID!,
      key_secret: env.RAZORPAY_KEY_SECRET!,
    });
  }
  return client;
}
