import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { BCRYPT_ROUNDS, SECURE_TOKEN_BYTES } from '@/constants';

/** Hash a password with bcrypt (12 rounds per spec). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Generate a cryptographically random token. We return the raw value (sent to
 * the user) and a SHA-256 hash (stored in the DB) so a database leak never
 * exposes a usable verification / reset link.
 */
export function generateSecureToken(bytes = SECURE_TOKEN_BYTES): { raw: string; hash: string } {
  const raw = crypto.randomBytes(bytes).toString('hex');
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Constant-time string comparison to avoid timing side-channels on secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
