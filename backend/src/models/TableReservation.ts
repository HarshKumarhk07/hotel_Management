import { Schema, model, type Document, type Types } from 'mongoose';
import { ALL_RESERVATION_STATUSES, RESERVATION_STATUS, type ReservationStatus, type PaymentStatus, PAYMENT_STATUS, type PaymentMethod, PAYMENT_METHODS } from '@/constants';

export interface ITableReservation extends Document {
  _id: Types.ObjectId;
  table: Types.ObjectId;
  kitchen: Types.ObjectId;
  guestName: string;
  phone: string;
  email?: string;
  partySize: number;
  scheduledAt: Date;
  durationMins: number;
  
  // Status
  status: ReservationStatus;
  
  // Payment & Locks
  paymentStatus: PaymentStatus;
  advancePercentage: number;
  amountPaid: number;
  remainingAmount: number;
  paymentId?: string;
  paymentMethod?: PaymentMethod;
  lockExpiresAt?: Date;

  // Timestamps & Audit
  confirmedAt?: Date;
  cancelledAt?: Date;
  completedAt?: Date;
  checkedInAt?: Date;
  notes?: string;
  cancelledBy?: Types.ObjectId;
  cancelReason?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;

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
      default: RESERVATION_STATUS.PENDING_PAYMENT,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    advancePercentage: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    paymentId: { type: String },
    paymentMethod: { type: String, enum: Object.values(PAYMENT_METHODS) },
    lockExpiresAt: { type: Date, index: true },

    confirmedAt: { type: Date },
    cancelledAt: { type: Date },
    completedAt: { type: Date },
    checkedInAt: { type: Date },

    notes:        { type: String, trim: true, maxlength: 300 },
    cancelledBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String, trim: true, maxlength: 300 },
    createdBy:    { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:    { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// Conflict detection: overlapping slots for the same table
reservationSchema.index({ table: 1, scheduledAt: 1 });
// Daily admin list: all reservations for a kitchen on a date
reservationSchema.index({ kitchen: 1, scheduledAt: 1, status: 1 });
// Availability engine: quick check for non-expired reservations
reservationSchema.index({ status: 1, lockExpiresAt: 1 });

export const TableReservation = model<ITableReservation>('TableReservation', reservationSchema);

