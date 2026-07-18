import type { NextFunction, Request, Response } from 'express';
import { User } from '@/models';
import { verifyAccessToken } from '@/utils/jwt';
import { AppError } from '@/utils/AppError';
import { asyncHandler } from '@/utils/asyncHandler';

/**
 * Verify the Bearer access token, confirm the user still exists and is active,
 * then populate `req.auth`. We re-check the DB on every request so deactivated
 * accounts lose access immediately (access tokens are short-lived but a 15-min
 * window of a banned admin acting freely is unacceptable for this system).
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or malformed Authorization header', 'NO_TOKEN');
    }
    const token = header.slice(7).trim();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw AppError.unauthorized('Invalid or expired access token', 'INVALID_TOKEN');
    }

    const user = await User.findById(payload.sub).select('+isActive');
    if (!user || !user.isActive) {
      throw AppError.unauthorized('Account not found or deactivated', 'ACCOUNT_INACTIVE');
    }

    req.auth = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      kitchenId: user.kitchen?.toString(),
    };
    next();
  },
);

/** Optional auth: populate req.auth if a valid token is present, else continue. */
export const optionalAuthenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();
    try {
      const payload = verifyAccessToken(header.slice(7).trim());
      const user = await User.findById(payload.sub).select('+isActive');
      if (user?.isActive) {
        req.auth = {
          userId: user._id.toString(),
          role: user.role,
          email: user.email,
          kitchenId: user.kitchen?.toString(),
        };
      }
    } catch {
      /* ignore — treated as anonymous */
    }
    next();
  },
);
