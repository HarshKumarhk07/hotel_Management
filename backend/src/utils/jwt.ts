import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '@/config/env';
import type { Role } from '@/constants';

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  kitchenId?: string; // present for KITCHEN_OWNER
  email: string;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  sid: string; // session/refresh-token document id
  jti: string; // unique token id for rotation tracking
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    algorithm: 'HS256',
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
    algorithm: 'HS256',
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
