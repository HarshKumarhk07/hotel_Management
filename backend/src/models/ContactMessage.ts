import { Schema, model, type Document, type Types } from 'mongoose';

export const CONTACT_STATUSES = ['UNREAD', 'READ', 'RESOLVED'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export interface IContactMessage extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  /** Kept in sync with `status` for backwards compatibility. */
  isRead: boolean;
  status: ContactStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contactMessageSchema = new Schema<IContactMessage>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false, index: true },
    status: { type: String, enum: CONTACT_STATUSES, default: 'UNREAD', index: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

contactMessageSchema.index({ createdAt: -1 });

export const ContactMessage = model<IContactMessage>('ContactMessage', contactMessageSchema);
