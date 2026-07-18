import type { Request, Response } from 'express';
import { REFRESH_COOKIE_NAME } from '@/constants';
import { User } from '@/models';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { clearRefreshCookie, setRefreshCookie } from '@/utils/cookies';
import { AppError } from '@/utils/AppError';
import { verifyRefreshToken } from '@/utils/jwt';
import { auditFromRequest } from '@/services/audit.service';
import { AUDIT_ACTIONS } from '@/constants';
import {
  revokeRefreshToken,
  rotateRefreshToken,
  type TokenPair,
} from '@/services/token.service';
import * as authService from './auth.service';

function meta(req: Request) {
  return { ip: req.context.ip, device: req.context.device };
}

/** Set refresh cookie + return access token in the body (kept out of storage). */
function sendSession(res: Response, tokens: TokenPair, user: unknown, status = 200) {
  setRefreshCookie(res, tokens.refreshToken);
  return ok(res, { user, accessToken: tokens.accessToken }, status);
}

export const register = asyncHandler(async (req, res) => {
  const { user } = await authService.register(req.body, meta(req));
  return created(res, {
    user,
    message: 'Registration successful. Please check your email to verify your account.',
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { user } = await authService.verifyEmail(req.body.token);
  return ok(res, { user, message: 'Email verified. You can now log in.' });
});

export const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.body.email);
  return ok(res, { message: 'If that email is registered and unverified, a new link has been sent.' });
});

export const login = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.login(req.body, meta(req));
  return sendSession(res, tokens, user);
});

export const google = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.googleLogin(req.body.idToken, meta(req));
  return sendSession(res, tokens, user);
});

/**
 * Rotate the refresh token. Reads the HttpOnly cookie, resolves the user, and
 * delegates rotation + reuse-detection to the token service.
 */
export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!raw) throw AppError.unauthorized('No refresh token provided', 'NO_REFRESH');

  let payload;
  try {
    payload = verifyRefreshToken(raw);
  } catch {
    clearRefreshCookie(res);
    throw AppError.unauthorized('Invalid refresh token', 'INVALID_REFRESH');
  }

  const user = await User.findById(payload.sub).select('+isActive');
  if (!user || !user.isActive) {
    clearRefreshCookie(res);
    throw AppError.unauthorized('Account not found or deactivated', 'ACCOUNT_INACTIVE');
  }

  const tokens = await rotateRefreshToken(raw, user, meta(req));
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.TOKEN_REFRESHED,
    actor: user._id.toString(),
    role: user.role,
  });
  return sendSession(res, tokens, undefined);
});

export const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (raw) await revokeRefreshToken(raw, 'logout');
  clearRefreshCookie(res);
  if (req.auth) {
    void auditFromRequest(req, {
      action: AUDIT_ACTIONS.LOGOUT,
      actor: req.auth.userId,
      role: req.auth.role,
    });
  }
  return ok(res, { message: 'Logged out' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  return ok(res, { message: 'If that email is registered, a reset link has been sent.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  return ok(res, { message: 'Password updated. Please log in with your new password.' });
});

/** Current authenticated user (requires access token). */
export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.auth!.userId);
  if (!user) throw AppError.notFound('User not found');
  return ok(res, { user });
});

export const checkRole = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.checkRole(req.query.email as string);
  return ok(res, result);
});
