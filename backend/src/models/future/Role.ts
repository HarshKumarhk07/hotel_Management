import { Schema, model, type Document, type Types } from 'mongoose';
import { ALL_PERMISSIONS, type Permission } from '@/constants';

/**
 * FUTURE-READY (not yet wired to routes).
 *
 * A custom, permission-based role for staff accounts. Lets a Kitchen Owner /
 * Super Admin define roles like "Chef", "Waiter", "Cashier" with explicit
 * permission grants, scoped to a kitchen (or global when `kitchen` is null).
 */
export interface IRole extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  permissions: Permission[];
  kitchen?: Types.ObjectId;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300 },
    permissions: [{ type: String, enum: ALL_PERMISSIONS }],
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', index: true },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

roleSchema.index({ kitchen: 1, name: 1 }, { unique: true });

export const Role = model<IRole>('Role', roleSchema);
