import { Schema, model, type Document, type Types } from 'mongoose';

export interface IBanquetBooking extends Document {
  _id: Types.ObjectId;
  hall: Types.ObjectId;
  guestName: string;
  phone: string;
  email: string;
  eventDate: Date;
  startTime: Date;
  endTime: Date;
  guestCount: number;
  eventType: string;
  menuPreset?: string;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID';
  createdAt: Date;
  updatedAt: Date;
}

const banquetBookingSchema = new Schema<IBanquetBooking>(
  {
    hall: { type: Schema.Types.ObjectId, ref: 'BanquetHall', required: true, index: true },
    guestName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    eventDate: { type: Date, required: true, index: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    guestCount: { type: Number, required: true, min: 1 },
    eventType: { type: String, required: true, trim: true },
    menuPreset: { type: String, trim: true },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID'],
      default: 'PENDING',
      index: true,
    },
  },
  { timestamps: true }
);

export const BanquetBooking = model<IBanquetBooking>('BanquetBooking', banquetBookingSchema);