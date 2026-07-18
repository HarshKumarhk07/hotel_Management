import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * A Kitchen is the tenant boundary. Every menu item, order, and kitchen-owner
 * account belongs to exactly one Kitchen. Created/managed by the Super Admin.
 */
export interface IKitchen extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  /** The KITCHEN_OWNER user who runs this kitchen. */
  owner?: Types.ObjectId;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  temporarilyClosed: boolean;
  weeklySchedule: number[];
  holidayTimings: {
    date: string;
    open?: string;
    close?: string;
    closed: boolean;
  }[];
  /** Operating window; orders blocked outside it (enforced in ordering phase). */
  timings?: {
    open: string; // "08:00"
    close: string; // "23:00"
    timezone: string; // IANA, e.g. "Asia/Kolkata"
  };
  settings: {
    serviceChargePercent: number;
    taxPercent: number;
    acceptsCOD: boolean;
    acceptsRoomBilling: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const kitchenSchema = new Schema<IKitchen>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 1000 },
    owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    temporarilyClosed: { type: Boolean, default: false },
    weeklySchedule: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    holidayTimings: {
      type: [
        {
          date: { type: String, required: true },
          open: { type: String },
          close: { type: String },
          closed: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    timings: {
      open: { type: String },
      close: { type: String },
      timezone: { type: String, default: 'Asia/Kolkata' },
    },
    settings: {
      serviceChargePercent: { type: Number, default: 0, min: 0, max: 100 },
      taxPercent: { type: Number, default: 5, min: 0, max: 100 },
      acceptsCOD: { type: Boolean, default: false },
      acceptsRoomBilling: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export const Kitchen = model<IKitchen>('Kitchen', kitchenSchema);
