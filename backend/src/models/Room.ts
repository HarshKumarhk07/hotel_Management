import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * A hotel Room with an embedded QR descriptor. The QR encodes a URL containing
 * the opaque `qr.token`; scanning resolves the room (and its serving kitchen) so
 * the order is attached automatically — the guest never types a room number.
 *
 * The token is rotated on (re)generation and on reassignment, which instantly
 * invalidates any previously printed code.
 */
export interface IRoomQr {
  token: string;
  isActive: boolean;
  version: number;
  generatedAt?: Date;
  disabledAt?: Date;
}

export interface IRoom extends Document {
  _id: Types.ObjectId;
  roomNumber: string;
  floor: number;
  /** Which kitchen serves this room (single- or multi-kitchen hotels). */
  kitchen?: Types.ObjectId;
  isActive: boolean;
  status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'BLOCKED' | 'OUT_OF_SERVICE' | 'VIP_RESERVED';
  qr: IRoomQr;
  roomType: string;
  capacity: number;
  bedType: 'SINGLE' | 'DOUBLE' | 'QUEEN' | 'KING';
  roomSizeSqFt: number;
  amenities: string[];
  pricePerNight: number;
  images: string[];
  cancellationPolicy: string;
  rules: string[];
  checkInTime: string;
  checkOutTime: string;
  /** Internal-only note, never exposed on customer-facing APIs. */
  internalNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    roomNumber: { type: String, required: true, trim: true, unique: true, index: true },
    floor: { type: Number, required: true, index: true },
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', index: true },
    isActive: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'BLOCKED', 'OUT_OF_SERVICE', 'VIP_RESERVED'],
      default: 'AVAILABLE',
      index: true,
    },
    roomType: {
      type: String,
      default: 'STANDARD',
      index: true,
    },
    capacity: { type: Number, default: 2 },
    bedType: {
      type: String,
      enum: ['SINGLE', 'DOUBLE', 'QUEEN', 'KING'],
      default: 'KING',
    },
    roomSizeSqFt: { type: Number, default: 350 },
    amenities: { type: [String], default: [] },
    pricePerNight: { type: Number, default: 5000 },
    images: { type: [String], default: [] },
    cancellationPolicy: { type: String, default: 'Free cancellation 24 hours prior to check-in.' },
    rules: { type: [String], default: [] },
    checkInTime: { type: String, default: '14:00' },
    checkOutTime: { type: String, default: '12:00' },
    qr: {
      token: { type: String, required: true, unique: true, index: true },
      isActive: { type: Boolean, default: true },
      version: { type: Number, default: 1 },
      generatedAt: { type: Date },
      disabledAt: { type: Date },
    },
    internalNote: { type: String, trim: true, maxlength: 500, select: false },
  },
  { timestamps: true },
);

roomSchema.index({ floor: 1, roomNumber: 1 });

export const Room = model<IRoom>('Room', roomSchema);
