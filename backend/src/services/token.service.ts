import { nanoid } from 'nanoid';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { AUDIT_ACTIONS } from '@/constants';
import { RefreshToken, type IUser } from '@/models';
import { hashToken } from '@/utils/crypto';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type RefreshTokenPayload,
} from '@/utils/jwt';
import { ms } from '@/utils/ms';
import type { DeviceInfo } from '@/utils/request';
import { AppError } from '@/utils/AppError';
import { recordAudit } from './audit.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface IssueContext {
  ip?: string;
  device?: DeviceInfo;
  /** Reuse the family on rotation; new login starts a fresh family. */
  family?: string;
}

function accessPayload(user: IUser) {
  return {
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
    kitchenId: user.kitchen?.toString(),
  };
}

/**
 * Issue a fresh access + refresh pair and persist the refresh token (hashed).
 * Each refresh JWT carries a unique `jti`; we store its hash so the raw token is
 * never recoverable from the DB.
 */
export async function issueTokenPair(user: IUser, ctx: IssueContext = {}): Promise<TokenPair> {
  const family = ctx.family ?? nanoid();
  const jti = nanoid();

  const sessionDoc = await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(jti),
    family,
    device: ctx.device ?? {},
    ip: ctx.ip,
    expiresAt: new Date(Date.now() + ms(env.REFRESH_TOKEN_TTL)),
  });

  const refreshToken = signRefreshToken({
    sub: user._id.toString(),
    sid: sessionDoc._id.toString(),
    jti,
  });
  const accessToken = signAccessToken(accessPayload(user));

  return { accessToken, refreshToken };
}

/**
 * Rotate a refresh token. Verifies the JWT, looks up the stored session, and:
 *  - If the token was already revoked/rotated → REUSE DETECTED. Revoke the whole
 *    family (likely token theft) and reject.
 *  - Otherwise revoke the presented token, issue a new pair in the same family.
 */
export async function rotateRefreshToken(
  rawToken: string,
  user: IUser,
  ctx: IssueContext = {},
): Promise<TokenPair> {
  let payload: RefreshTokenPayload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw AppError.unauthorized('Invalid refresh token', 'INVALID_REFRESH');
  }

  const stored = await RefreshToken.findById(payload.sid);
  if (!stored || stored.user.toString() !== user._id.toString()) {
    throw AppError.unauthorized('Session not found', 'SESSION_NOT_FOUND');
  }

  const presentedHash = hashToken(payload.jti);

  // Reuse detection: token already revoked or already rotated away.
  if (stored.revokedAt || stored.rotatedTo || stored.tokenHash !== presentedHash) {
    await revokeFamily(stored.family, 'reuse_detected');
    void recordAudit({
      action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED,
      actor: user._id.toString(),
      role: user.role,
      metadata: { family: stored.family },
      success: false,
    });
    logger.warn({ userId: user._id.toString(), family: stored.family }, 'Refresh token reuse detected');
    throw AppError.unauthorized('Refresh token reuse detected. Please log in again.', 'TOKEN_REUSE');
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    throw AppError.unauthorized('Refresh token expired', 'REFRESH_EXPIRED');
  }

  // Issue the replacement within the same family.
  const newJti = nanoid();
  const newSession = await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(newJti),
    family: stored.family,
    device: ctx.device ?? stored.device,
    ip: ctx.ip ?? stored.ip,
    expiresAt: new Date(Date.now() + ms(env.REFRESH_TOKEN_TTL)),
  });

  stored.revokedAt = new Date();
  stored.revokedReason = 'rotated';
  stored.rotatedTo = newJti;
  await stored.save();

  const refreshToken = signRefreshToken({
    sub: user._id.toString(),
    sid: newSession._id.toString(),
    jti: newJti,
  });
  const accessToken = signAccessToken(accessPayload(user));

  return { accessToken, refreshToken };
}

/** Revoke a single session by its refresh JWT (used on logout). */
export async function revokeRefreshToken(rawToken: string, reason = 'logout'): Promise<void> {
  let payload: RefreshTokenPayload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    return; // already invalid — nothing to do
  }
  await RefreshToken.updateOne(
    { _id: payload.sid, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

/** Revoke every active session in a family (reuse detection / logout-all). */
export async function revokeFamily(family: string, reason: string): Promise<void> {
  await RefreshToken.updateMany(
    { family, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

/** Revoke all of a user's sessions (e.g. after a password reset). */
export async function revokeAllUserSessions(userId: string, reason: string): Promise<void> {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}
