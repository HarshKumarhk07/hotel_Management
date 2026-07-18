import rateLimit, { type Options } from 'express-rate-limit';
import { isTest } from '@/config/env';
import { AppError } from '@/utils/AppError';

/**
 * Factory for express-rate-limit instances with our standard behaviour:
 *  - Keyed by client IP (honours the trusted proxy via app.set('trust proxy')).
 *  - Standard `RateLimit-*` headers, legacy headers off.
 *  - Disabled entirely under tests so the suite isn't throttled.
 */
function makeLimiter(opts: Partial<Options> & { windowMs: number; max: number }) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTest,
    handler: (_req, _res, next) =>
      next(AppError.tooMany('Too many requests, please try again later.')),
    ...opts,
  });
}

/** Generic API limiter, applied globally. */
export const globalLimiter = makeLimiter({ windowMs: 15 * 60_000, max: 1000 });

/** Tight limits on auth-sensitive endpoints (brute-force resistance). */
export const loginLimiter = makeLimiter({ windowMs: 15 * 60_000, max: 10 });
export const registerLimiter = makeLimiter({ windowMs: 60 * 60_000, max: 10 });
export const forgotPasswordLimiter = makeLimiter({ windowMs: 60 * 60_000, max: 5 });
export const emailVerifyLimiter = makeLimiter({ windowMs: 60 * 60_000, max: 10 });

/** Used in later phases. */
export const paymentLimiter = makeLimiter({ windowMs: 15 * 60_000, max: 30 });
export const couponLimiter = makeLimiter({ windowMs: 15 * 60_000, max: 50 });

/** Guest (un-authenticated) checkout — abuse-resistant but usable per device/IP. */
export const guestCheckoutLimiter = makeLimiter({ windowMs: 15 * 60_000, max: 20 });
