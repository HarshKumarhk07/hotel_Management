import { Schema, model, type Document, type Types } from 'mongoose';
import { DISCOUNT_TYPES, type DiscountType } from '@/constants';

/**
 * A discount coupon. Can be global (no `kitchen`) or scoped to one kitchen.
 * `usageLimit` caps total redemptions; `perUserLimit` caps redemptions per
 * customer (enforced via CouponRedemption records).
 */
export interface ICoupon extends Document {
  _id: Types.ObjectId;
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  /** For PERCENT coupons, an optional absolute cap on the discount. */
  maxDiscount?: number;
  minOrderValue: number;
  /** null/undefined = unlimited. */
  usageLimit?: number;
  perUserLimit: number;
  usedCount: number;
  startsAt?: Date;
  expiresAt?: Date;
  kitchen?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 300 },
    discountType: { type: String, enum: Object.values(DISCOUNT_TYPES), required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, min: 1 },
    perUserLimit: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date },
    expiresAt: { type: Date, index: true },
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Coupon = model<ICoupon>('Coupon', couponSchema);
