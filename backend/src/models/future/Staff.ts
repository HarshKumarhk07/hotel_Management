import { Schema, model, type Document, type Types } from 'mongoose';
import { STAFF_STATUS, type StaffStatus } from '@/constants';

/**
 * FUTURE-READY (not yet wired to routes).
 *
 * A staff member working under a kitchen. Links to a `User` account for login
 * and a `Role` for permissions. This lets a kitchen employ multiple workers
 * (chefs, waiters) without each being a full KITCHEN_OWNER.
 */
export interface IStaff extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  kitchen: Types.ObjectId;
  role?: Types.ObjectId;
  employeeId?: string;
  designation?: string;
  status: StaffStatus;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const staffSchema = new Schema<IStaff>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', index: true },
    role: { type: Schema.Types.ObjectId, ref: 'Role' },
    employeeId: { type: String, trim: true },
    designation: { type: String, trim: true, maxlength: 80 },
    status: { type: String, enum: Object.values(STAFF_STATUS), default: STAFF_STATUS.ACTIVE, index: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

staffSchema.index({ kitchen: 1, user: 1 }, { unique: true });

export const Staff = model<IStaff>('Staff', staffSchema);
