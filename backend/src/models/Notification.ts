import { Schema, model, type Document, type Types } from 'mongoose';
import { NOTIFICATION_TYPES, type NotificationType } from '@/constants';
import { env } from '@/config/env';

/**
 * An in-app notification for a single recipient. Email delivery (Brevo) happens
 * alongside creation in the notification service; this document is the in-app
 * feed record and read-state tracker.
 */
export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  order?: Types.ObjectId;
  /** Free-form context for the client (orderNumber, refund status, etc.). */
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  emailSent: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
// Retention: the in-app feed is ephemeral — drop notifications past the
// configured age via MongoDB's TTL monitor so the collection stays bounded.
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: env.NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 },
);

export const Notification = model<INotification>('Notification', notificationSchema);
