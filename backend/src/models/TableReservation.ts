import { Schema, model, type Document, type Types } from 'mongoose';
import { ALL_RESERVATION_STATUSES, RESERVATION_STATUS, type ReservationStatus } from '@/constants';

export interface ITableReservation extends Document {
  _id: Types.ObjectId;
  table: Types.ObjectId;
  /** Denormalised for fast daily-list queries without a join. */
  kitchen: Types.ObjectId;
  guestName: string;
  phone: string;
  email?: string;
  partySize: number;
  scheduledAt: Date;
  durationMins: number;
  status: ReservationStatus;
  notes?: string;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reservationSchema = new Schema<ITableReservation>(
  {
    table:       { type: Schema.Types.ObjectId, ref: 'RestaurantTable', required: true, index: true },
    kitchen:     { type: Schema.Types.ObjectId, ref: 'Kitchen', required: true, index: true },
    guestName:   { type: String, required: true, trim: true, maxlength: 120 },
    phone:       { type: String, required: true, trim: true, index: true },
    email:       { type: String, trim: true, lowercase: true },
    partySize:   { type: Number, required: true, min: 1, max: 50 },
    scheduledAt: { type: Date, required: true, index: true },
    durationMins:{ type: Number, default: 90, min: 30 },
    status: {
      type: String,
      enum: ALL_RESERVATION_STATUSES,
      default: RESERVATION_STATUS.PENDING,
      index: true,
    },
    notes:        { type: String, trim: true, maxlength: 300 },
    cancelledBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt:  { type: Date },
    cancelReason: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

// Conflict detection: overlapping slots for the same table
reservationSchema.index({ table: 1, scheduledAt: 1 });
// Daily admin list: all reservations for a kitchen on a date
reservationSchema.index({ kitchen: 1, scheduledAt: 1, status: 1 });

export const TableReservation = model<ITableReservation>('TableReservation', reservationSchema);
