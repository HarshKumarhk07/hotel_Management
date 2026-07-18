import { logger } from '@/config/logger';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  ORDER_STATUS_NOTIFICATION,
  REFUND_STATUS,
  ROLES,
  SOCKET_EVENTS,
  type NotificationChannel,
  type NotificationType,
} from '@/constants';
import { Kitchen, Notification, User, type IOrder } from '@/models';
import { emitToUser } from '@/realtime/emit';
import { emailService } from './email/brevo.service';

interface NotifyInput {
  recipient: string;
  type: NotificationType;
  title: string;
  message: string;
  order?: string;
  orderNumber?: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
}

/**
 * Create one notification: persist the in-app record, push it live over the
 * recipient's socket room, and (if the EMAIL channel is requested) send a Brevo
 * email. Never throws — notification delivery must not break the triggering
 * action. Call with `void`.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const channels = input.channels ?? [NOTIFICATION_CHANNELS.IN_APP];
  try {
    const wantsEmail = channels.includes(NOTIFICATION_CHANNELS.EMAIL);
    const doc = await Notification.create({
      recipient: input.recipient,
      type: input.type,
      title: input.title,
      message: input.message,
      order: input.order,
      data: { ...input.data, orderNumber: input.orderNumber },
      emailSent: false,
    });

    // In-app: live push.
    if (channels.includes(NOTIFICATION_CHANNELS.IN_APP)) {
      emitToUser(input.recipient, SOCKET_EVENTS.NOTIFICATION_NEW, {
        id: doc._id.toString(),
        type: doc.type,
        title: doc.title,
        message: doc.message,
        order: input.order,
        createdAt: doc.createdAt,
      });
    }

    // Email: best-effort, then flag the record.
    if (wantsEmail) {
      const user = await User.findById(input.recipient).select('name email');
      if (user?.email) {
        await emailService.sendNotificationEmail(
          user.email,
          user.name,
          input.title,
          input.message,
          input.orderNumber,
        );
        doc.emailSent = true;
        await doc.save();
      }
    }

    // SMS: best-effort dispatch.
    const wantsSms = channels.includes(NOTIFICATION_CHANNELS.SMS);
    if (wantsSms) {
      const user = await User.findById(input.recipient).select('phone');
      if (user?.phone) {
        logger.info({ phone: user.phone, message: `${input.title}: ${input.message}` }, 'SMS dispatched successfully via mock gateway');
      }
    }
  } catch (err) {
    logger.error({ err, type: input.type }, 'Failed to create notification');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level, domain-specific helpers (called from order/payment services)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify the order's customer, transparently handling guest orders. Registered
 * customers get the full treatment (in-app feed + live socket push + optional
 * email); guest orders have no User/socket session, so they receive an email
 * only (when the EMAIL channel is requested).
 */
async function notifyOrderCustomer(
  order: IOrder,
  content: {
    type: NotificationType;
    title: string;
    message: string;
    channels: NotificationChannel[];
    data?: Record<string, unknown>;
  },
): Promise<void> {
  if (order.customer) {
    await notify({
      recipient: order.customer.toString(),
      type: content.type,
      title: content.title,
      message: content.message,
      order: order._id.toString(),
      orderNumber: order.orderNumber,
      data: content.data,
      channels: content.channels,
    });
    return;
  }
  // Guest order → email only.
  if (order.guestInfo?.email && content.channels.includes(NOTIFICATION_CHANNELS.EMAIL)) {
    try {
      await emailService.sendNotificationEmail(
        order.guestInfo.email,
        order.guestInfo.name,
        content.title,
        content.message,
        order.orderNumber,
      );
    } catch (err) {
      logger.error({ err, type: content.type }, 'Failed to send guest notification email');
    }
  }

  // Guest order → SMS dispatch.
  if (order.guestInfo?.phone && content.channels.includes(NOTIFICATION_CHANNELS.SMS)) {
    logger.info({ phone: order.guestInfo.phone, message: `${content.title}: ${content.message}` }, 'SMS dispatched successfully to guest via mock gateway');
  }
}

export function notifyCustomerOrderReceived(order: IOrder): Promise<void> {
  return notifyOrderCustomer(order, {
    type: NOTIFICATION_TYPES.ORDER_RECEIVED,
    title: 'Order placed',
    message: `We've received your order ${order.orderNumber}.`,
    channels: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL],
  });
}

/** Map an order's current status to the matching customer notification. */
export function notifyCustomerStatus(order: IOrder): Promise<void> {
  const tpl = ORDER_STATUS_NOTIFICATION[order.status];
  if (!tpl) return Promise.resolve();
  // Email the milestones the guest cares about; keep interim ones in-app only.
  const emailWorthy = [
    NOTIFICATION_TYPES.ORDER_DELIVERED,
    NOTIFICATION_TYPES.ORDER_REJECTED,
  ] as NotificationType[];
  const channels = emailWorthy.includes(tpl.type)
    ? [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL]
    : [NOTIFICATION_CHANNELS.IN_APP];
  return notifyOrderCustomer(order, {
    type: tpl.type,
    title: tpl.title,
    message: tpl.message,
    channels,
  });
}

export function notifyCustomerCancelled(order: IOrder, reason: string): Promise<void> {
  return notifyOrderCustomer(order, {
    type: NOTIFICATION_TYPES.ORDER_CANCELLED,
    title: 'Order cancelled',
    message: `Your order ${order.orderNumber} was cancelled. Reason: ${reason}`,
    channels: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL],
  });
}

export function notifyCustomerRefund(order: IOrder): Promise<void> {
  const refunded = order.refund.status === REFUND_STATUS.REFUNDED;
  return notifyOrderCustomer(order, {
    type: NOTIFICATION_TYPES.REFUND_UPDATE,
    title: refunded ? 'Refund completed' : 'Refund update',
    message: refunded
      ? `Your refund of ${order.refund.amount} for ${order.orderNumber} has been processed.`
      : `Your refund for ${order.orderNumber} is now ${order.refund.status}.`,
    data: { refundStatus: order.refund.status, amount: order.refund.amount },
    channels: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL],
  });
}

/** Notify the kitchen owner of a new (paid/confirmed) order. */
export async function notifyKitchenNewOrder(order: IOrder): Promise<void> {
  const kitchen = await Kitchen.findById(order.kitchen).select('owner');
  if (!kitchen?.owner) return;
  await notify({
    recipient: kitchen.owner.toString(),
    type: NOTIFICATION_TYPES.KITCHEN_NEW_ORDER,
    title: 'New order',
    message: `New order ${order.orderNumber} for ${order.roomSnapshot?.roomNumber ? `room ${order.roomSnapshot.roomNumber}` : `table ${order.tableSnapshot?.number ?? ''}`}.`,
    order: order._id.toString(),
    orderNumber: order.orderNumber,
  });
}

export async function notifyKitchenCancellation(order: IOrder, reason: string): Promise<void> {
  const kitchen = await Kitchen.findById(order.kitchen).select('owner');
  if (!kitchen?.owner) return;
  await notify({
    recipient: kitchen.owner.toString(),
    type: NOTIFICATION_TYPES.KITCHEN_CANCELLATION,
    title: 'Order cancelled',
    message: `Order ${order.orderNumber} was cancelled. Reason: ${reason}`,
    order: order._id.toString(),
    orderNumber: order.orderNumber,
  });
}

/** Fan out an admin alert to every active Super Admin. */
async function notifyAdmins(
  type: NotificationType,
  title: string,
  message: string,
  order?: IOrder,
): Promise<void> {
  const admins = await User.find({ role: ROLES.SUPER_ADMIN, isActive: true }).select('_id');
  await Promise.all(
    admins.map((a) =>
      notify({
        recipient: a._id.toString(),
        type,
        title,
        message,
        order: order?._id.toString(),
        orderNumber: order?.orderNumber,
        channels: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL],
      }),
    ),
  );
}

export function notifyAdminsPaymentFailed(order: IOrder): Promise<void> {
  return notifyAdmins(
    NOTIFICATION_TYPES.ADMIN_PAYMENT_FAILED,
    'Payment failed',
    `Payment failed for order ${order.orderNumber} (${order.payment.failureReason ?? 'unknown reason'}).`,
    order,
  );
}
