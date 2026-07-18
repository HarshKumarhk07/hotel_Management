import { Schema, model, type Document, type Types } from 'mongoose';
import { SHIFT_STATUS, type ShiftStatus } from '@/constants';

/**
 * FUTURE-READY (not yet wired to routes).
 *
 * A scheduled work shift for a staff member, with optional clock-in/out and
 * break tracking — the basis for the future shift-management module.
 */
export interface IShift extends Document {
  _id: Types.ObjectId;
  staff: Types.ObjectId;
  kitchen: Types.ObjectId;
  scheduledStart: Date;
  scheduledEnd: Date;
  clockInAt?: Date;
  clockOutAt?: Date;
  breaks: { start: Date; end?: Date }[];
  status: ShiftStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const shiftSchema = new Schema<IShift>(
  {
    staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', required: true, index: true },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    clockInAt: { type: Date },
    clockOutAt: { type: Date },
    breaks: [{ start: { type: Date }, end: { type: Date } }],
    status: { type: String, enum: Object.values(SHIFT_STATUS), default: SHIFT_STATUS.SCHEDULED, index: true },
    notes: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

shiftSchema.index({ kitchen: 1, scheduledStart: 1 });

export const Shift = model<IShift>('Shift', shiftSchema);
