import { Schema, model, type Document, type Types } from 'mongoose';
import { TOKEN_TYPES, type TokenType } from '@/constants';

/**
 * Short-lived, single-use tokens for email verification and password reset.
 * Only the SHA-256 hash of the token is stored. TTL index auto-expires them.
 */
export interface IVerificationToken extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: TokenType;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const verificationTokenSchema = new Schema<IVerificationToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(TOKEN_TYPES), required: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
verificationTokenSchema.index({ user: 1, type: 1 });

export const VerificationToken = model<IVerificationToken>(
  'VerificationToken',
  verificationTokenSchema,
);
