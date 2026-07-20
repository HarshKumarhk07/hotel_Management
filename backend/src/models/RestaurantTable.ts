import { Schema, model, type Document, type Types } from 'mongoose';
import {
  ALL_TABLE_STATUSES,
  TABLE_STATUS,
  type TableStatus,
} from '@/constants';

export interface ITableSession {
  seatedAt: Date;
  partySize: number;
  guestName?: string;
  phone?: string;
  email?: string;
  reservationId?: Types.ObjectId;
  notes?: string;
  billAmount?: number;
}

export interface IRestaurantTable extends Document {
  _id: Types.ObjectId;
  /** Display label, e.g. "T-01", "Bar-3". Unique per kitchen. */
  number: string;
  floor: number;
  section?: string;
  capacity: number;
  kitchen: Types.ObjectId;
  isActive: boolean;
  status: TableStatus;
  qr: {
    token: string;
    isActive: boolean;
    version: number;
    generatedAt?: Date;
  };
  /** Populated only while status = OCCUPIED | BILLING. Cleared on close. */
  currentSession?: ITableSession;
  createdAt: Date;
  updatedAt: Date;
}

const tableSchema = new Schema<IRestaurantTable>(
  {
    number:   { type: String, required: true, trim: true, maxlength: 20 },
    floor:    { type: Number, required: true, default: 0 },
    section:  { type: String, trim: true, maxlength: 60 },
    capacity: { type: Number, required: true, min: 1, max: 50 },
    kitchen:  { type: Schema.Types.ObjectId, ref: 'Kitchen', required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: ALL_TABLE_STATUSES,
      default: TABLE_STATUS.AVAILABLE,
      index: true,
    },
    qr: {
      token:       { type: String, required: true, unique: true, index: true },
      isActive:    { type: Boolean, default: true },
      version:     { type: Number, default: 1 },
      generatedAt: { type: Date },
    },
    currentSession: {
      seatedAt:      { type: Date },
      partySize:     { type: Number, min: 1 },
      guestName:     { type: String, trim: true, maxlength: 120 },
      phone:         { type: String, trim: true },
      email:         { type: String, trim: true, lowercase: true },
      reservationId: { type: Schema.Types.ObjectId, ref: 'TableReservation' },
      notes:         { type: String, trim: true, maxlength: 300 },
      billAmount:    { type: Number, min: 0 },
    },
  },
  { timestamps: true },
);

tableSchema.index({ kitchen: 1, status: 1 });
tableSchema.index({ kitchen: 1, isActive: 1 });
// number must be unique within a kitchen (not globally)
tableSchema.index({ kitchen: 1, number: 1 }, { unique: true });

export const RestaurantTable = model<IRestaurantTable>('RestaurantTable', tableSchema);
