import { Schema, model, type Document, type Types } from 'mongoose';

export interface IRoomBooking extends Document {
  _id: Types.ObjectId;
  room: Types.ObjectId;
  guestName: string;
  phone: string;
  email: string;
  checkInDate: Date;
  checkOutDate: Date;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID';
  createdAt: Date;
  updatedAt: Date;
}

const roomBookingSchema = new Schema<IRoomBooking>(
  {
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    guestName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    checkInDate: { type: Date, required: true, index: true },
    checkOutDate: { type: Date, required: true, index: true },
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'],
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

export const RoomBooking = model<IRoomBooking>('RoomBooking', roomBookingSchema);
