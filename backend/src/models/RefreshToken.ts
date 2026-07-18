import { Schema, model, type Document, type Types } from 'mongoose';
import type { DeviceInfo } from '@/utils/request';

/**
 * One document per issued refresh token (i.e. per session/device). Supports
 * refresh-token rotation with reuse-detection:
 *  - On refresh we mark the old token `rotatedTo` the new token id and revoke it.
 *  - If a *revoked* token is presented again, that signals theft → we revoke the
 *    entire session family (everything sharing the same `family`).
 * Token values are stored hashed; a DB leak can't be replayed.
 */
export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  /** SHA-256 of the JWT's jti, used to look the token up. */
  tokenHash: string;
  /** Session family id — shared across a rotation chain. */
  family: string;
  device: Partial<DeviceInfo>;
  ip?: string;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  /** jti of the token this one was rotated into (forward pointer). */
  rotatedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    family: { type: String, required: true, index: true },
    device: {
      userAgent: String,
      browser: String,
      os: String,
      device: String,
      fingerprint: String,
    },
    ip: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String },
    rotatedTo: { type: String },
  },
  { timestamps: true },
);

// TTL index: Mongo purges expired sessions automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
