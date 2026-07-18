import type { FilterQuery } from 'mongoose';
import { AUDIT_ACTIONS } from '@/constants';
import { logger } from '@/config/logger';
import { Order, type IOrder, type IUser } from '@/models';
import { recordAudit } from '@/services/audit.service';
import { normalizeEmail, normalizePhone } from '@/utils/normalize';
import type { DeviceInfo } from '@/utils/request';

interface LinkMeta {
  ip?: string;
  device?: DeviceInfo;
}

/**
 * Claim a verified account's prior guest orders.
 *
 * Matching rules (strict — never name, never partial):
 *   1. Verified email  (primary)
 *   2. Normalized phone (secondary)
 * Only exact normalized matches are linked.
 *
 * Safety:
 *   - Requires `isEmailVerified === true`, so nobody can grab another person's
 *     order history by registering an address they don't control.
 *   - Only touches owner-less, not-yet-linked guest orders (`customer` absent,
 *     `linkedToAccount === false`), so it never reassigns an existing owner.
 *   - Idempotent: a single atomic `updateMany`; re-running links nothing new.
 */
export async function linkGuestOrders(user: IUser, meta?: LinkMeta): Promise<{ linked: number }> {
  if (!user.isEmailVerified) {
    void recordAudit({
      action: AUDIT_ACTIONS.ORDER_LINK_FAILED,
      actor: user._id.toString(),
      actorEmail: user.email,
      role: user.role,
      success: false,
      ip: meta?.ip,
      metadata: { reason: 'email_not_verified' },
    });
    return { linked: 0 };
  }

  const email = normalizeEmail(user.email);
  const phone = normalizePhone(user.phone);

  const match: FilterQuery<IOrder>[] = [{ 'guestInfo.email': email }];
  if (phone) match.push({ 'guestInfo.phoneNormalized': phone });

  const result = await Order.updateMany(
    { customer: { $exists: false }, linkedToAccount: false, $or: match },
    { $set: { customer: user._id, linkedToAccount: true } },
  );

  const linked = result.modifiedCount ?? 0;
  if (linked > 0) {
    void recordAudit({
      action: AUDIT_ACTIONS.ORDER_LINKED,
      actor: user._id.toString(),
      actorEmail: user.email,
      role: user.role,
      ip: meta?.ip,
      metadata: { linked, byEmail: email, byPhone: phone || undefined },
    });
    logger.info({ userId: user._id.toString(), linked }, 'Linked guest orders to account');
  }

  return { linked };
}
