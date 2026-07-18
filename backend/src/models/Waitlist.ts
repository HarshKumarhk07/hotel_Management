import { Schema, model, type Document, type Types } from 'mongoose';

export interface IWaitlist extends Document {
  _id: Types.ObjectId;
  guestName: string;
  phone: string;
  email: string;
  guestsCount: number;
  position: number;
  status: 'PENDING' | 'SEATED' | 'CANCELLED';
  assignedTable?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const waitlistSchema = new Schema<IWaitlist>(
  {
    guestName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    guestsCount: { type: Number, required: true, min: 1 },
    position: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'SEATED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    assignedTable: { type: Schema.Types.ObjectId, ref: 'RestaurantTable', index: true },
  },
  { timestamps: true }
);

export const Waitlist = model<IWaitlist>('Waitlist', waitlistSchema);
