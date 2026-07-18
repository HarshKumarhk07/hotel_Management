import type { CookieOptions, Response } from 'express';
import { env, isProd } from '@/config/env';
import { REFRESH_COOKIE_NAME } from '@/constants';
import { ms } from './ms';

/**
 * Hardened cookie defaults: HttpOnly + Secure + SameSite=Strict per the security
 * spec. The refresh cookie is scoped to the refresh endpoint path so it is not
 * sent on every request.
 */
function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd, // Secure required over HTTPS in prod; relaxed for localhost
    sameSite: isProd ? 'none' : 'strict',
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/',
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: ms(env.REFRESH_TOKEN_TTL),
    path: `${env.API_PREFIX}/auth`, // only sent to auth endpoints
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { ...baseOptions(), path: `${env.API_PREFIX}/auth` });
}
