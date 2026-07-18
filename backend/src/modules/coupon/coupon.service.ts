import { type FilterQuery } from 'mongoose';
import { DISCOUNT_TYPES } from '@/constants';
import { Coupon, CouponRedemption, CouponUserCounter, type ICoupon } from '@/models';
import { round2 } from '@/services/pricing.service';
import { getPageParams, pageMeta } from '@/utils/pagination';
import { AppError } from '@/utils/AppError';

export interface CouponInput {
  code: string;
  description?: string;
  discountType: (typeof DISCOUNT_TYPES)[keyof typeof DISCOUNT_TYPES];
  discountValue: number;
  maxDiscount?: number;
  minOrderValue?: number;
  usageLimit?: number;
  perUserLimit?: number;
  startsAt?: Date;
  expiresAt?: Date;
  kitchen?: string;
}

export async function createCoupon(input: CouponInput) {
  const exists = await Coupon.findOne({ code: input.code.toUpperCase() });
  if (exists) throw AppError.conflict('A coupon with this code already exists', 'COUPON_EXISTS');
  if (input.discountType === DISCOUNT_TYPES.PERCENT && input.discountValue > 100) {
    throw AppError.badRequest('Percentage discount cannot exceed 100', 'INVALID_PERCENT');
  }
  return Coupon.create({ ...input, code: input.code.toUpperCase() });
}

export async function listCoupons(query: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  kitchen?: string;
}) {
  const { page, limit, skip } = getPageParams(query);
  const filter: FilterQuery<ICoupon> = {};
  if (typeof query.isActive === 'boolean') filter.isActive = query.isActive;
  if (query.kitchen) filter.kitchen = query.kitchen;
  const [items, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Coupon.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(total, page, limit) };
}

export async function getCoupon(id: string) {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw AppError.notFound('Coupon not found');
  return coupon;
}

export async function updateCoupon(id: string, input: Partial<CouponInput> & { isActive?: boolean }) {
  const coupon = await getCoupon(id);
  Object.assign(coupon, input);
  await coupon.save();
  return coupon;
}

export async function deleteCoupon(id: string) {
  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) throw AppError.notFound('Coupon not found');
  return coupon;
}

/** Compute the discount a coupon yields against a subtotal (capped, never < 0). */
export function computeDiscount(coupon: ICoupon, subtotal: number): number {
  let discount =
    coupon.discountType === DISCOUNT_TYPES.PERCENT
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue;
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  return round2(Math.max(0, Math.min(discount, subtotal)));
}

/**
 * Validate a coupon for a user/kitchen/subtotal and return the resolved coupon
 * plus the discount it would apply. Throws a specific error for every failure
 * mode so the UI can show a precise message.
 */
export async function validateCoupon(
  code: string,
  ctx: { userId?: string; kitchenId: string; subtotal: number; now?: Date },
): Promise<{ coupon: ICoupon; discount: number }> {
  const now = ctx.now ?? new Date();
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon || !coupon.isActive) {
    throw AppError.badRequest('Invalid coupon code', 'COUPON_INVALID');
  }
  if (coupon.kitchen && coupon.kitchen.toString() !== ctx.kitchenId) {
    throw AppError.badRequest('This coupon is not valid for this kitchen', 'COUPON_WRONG_KITCHEN');
  }
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) {
    throw AppError.badRequest('This coupon is not active yet', 'COUPON_NOT_STARTED');
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime()) {
    throw AppError.badRequest('This coupon has expired', 'COUPON_EXPIRED');
  }
  if (ctx.subtotal < coupon.minOrderValue) {
    throw AppError.badRequest(
      `Add items worth at least ${coupon.minOrderValue} to use this coupon`,
      'COUPON_MIN_ORDER',
    );
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw AppError.badRequest('This coupon has reached its usage limit', 'COUPON_EXHAUSTED');
  }
  // Per-user limit only applies to authenticated users (guests have no identity
  // to count against — they're bounded by the global usage limit instead).
  if (ctx.userId) {
    const userUses = await CouponRedemption.countDocuments({ coupon: coupon._id, user: ctx.userId });
    if (userUses >= coupon.perUserLimit) {
      throw AppError.badRequest('You have already used this coupon', 'COUPON_USER_LIMIT');
    }
  }

  const discount = computeDiscount(coupon, ctx.subtotal);
  if (discount <= 0) throw AppError.badRequest('This coupon yields no discount', 'COUPON_NO_DISCOUNT');
  return { coupon, discount };
}

/**
 * Atomically reserve one use of a coupon (guards against over-redemption under
 * concurrency). Returns true on success; false if the limit was just hit.
 */
export async function reserveCoupon(couponId: string): Promise<boolean> {
  const res = await Coupon.findOneAndUpdate(
    {
      _id: couponId,
      isActive: true,
      $or: [{ usageLimit: { $exists: false } }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
    },
    { $inc: { usedCount: 1 } },
    { new: true },
  );
  return Boolean(res);
}

/** Roll back a reservation if order creation fails after reserving. */
export async function releaseCoupon(couponId: string): Promise<void> {
  await Coupon.updateOne({ _id: couponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
}

/**
 * Atomically reserve one *per-user* use of a coupon. This is the authoritative
 * guard against exceeding `perUserLimit` under concurrency — the non-atomic
 * `countDocuments` check in `validateCoupon` is only a preview.
 *
 * Strategy: a single (coupon, user) counter row with a unique index.
 *  - If a row exists with `count < perUserLimit`, atomically `$inc` it.
 *  - If a row exists at the limit, the filter misses and the upsert tries to
 *    insert — the unique index rejects it (E11000) → limit reached → `false`.
 *  - On the very first use, the upsert creates the row at count 1.
 *
 * Returns true if a use was reserved, false if the per-user limit is reached.
 */
export async function reserveUserLimit(
  couponId: string,
  userId: string,
  perUserLimit: number,
): Promise<boolean> {
  try {
    const res = await CouponUserCounter.findOneAndUpdate(
      { coupon: couponId, user: userId, count: { $lt: perUserLimit } },
      { $inc: { count: 1 }, $setOnInsert: { coupon: couponId, user: userId } },
      { new: true, upsert: true },
    );
    return Boolean(res);
  } catch (err: unknown) {
    // Unique-index collision = a limit row already exists at/above the cap, or a
    // concurrent first-use won the insert. Either way this caller is over the cap.
    if ((err as { code?: number }).code === 11000) return false;
    throw err;
  }
}

/** Roll back a per-user reservation if order creation fails after reserving. */
export async function releaseUserLimit(couponId: string, userId: string): Promise<void> {
  await CouponUserCounter.updateOne(
    { coupon: couponId, user: userId, count: { $gt: 0 } },
    { $inc: { count: -1 } },
  );
}

export async function recordRedemption(
  couponId: string,
  userId: string,
  orderId: string,
  discount: number,
): Promise<void> {
  await CouponRedemption.create({ coupon: couponId, user: userId, order: orderId, discount });
}
