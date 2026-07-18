import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * Atomic per-user redemption counter for a coupon. One document per
 * (coupon, user); `count` is incremented under a `count < perUserLimit` guard so
 * the per-user limit can never be exceeded under concurrency. The unique index
 * makes the first-use upsert collide (instead of double-inserting) when a limit
 * row already exists, which the service interprets as "limit reached".
 *
 * This is the authoritative gate; `CouponRedemption` remains the human/audit
 * record of each successful use.
 */
export interface ICouponUserCounter extends Document {
  _id: Types.ObjectId;
  coupon: Types.ObjectId;
  user: Types.ObjectId;
  count: number;
}

const couponUserCounterSchema = new Schema<ICouponUserCounter>({
  coupon: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  count: { type: Number, required: true, default: 0, min: 0 },
});

couponUserCounterSchema.index({ coupon: 1, user: 1 }, { unique: true });

export const CouponUserCounter = model<ICouponUserCounter>(
  'CouponUserCounter',
  couponUserCounterSchema,
);
