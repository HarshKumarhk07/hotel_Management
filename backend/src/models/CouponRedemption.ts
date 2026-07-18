import { Schema, model, type Document, type Types } from 'mongoose';

/** One record per successful coupon use — drives the per-user limit check. */
export interface ICouponRedemption extends Document {
  _id: Types.ObjectId;
  coupon: Types.ObjectId;
  user: Types.ObjectId;
  order: Types.ObjectId;
  discount: number;
  createdAt: Date;
}

const couponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    coupon: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    discount: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

couponRedemptionSchema.index({ coupon: 1, user: 1 });

export const CouponRedemption = model<ICouponRedemption>(
  'CouponRedemption',
  couponRedemptionSchema,
);
