import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * FUTURE-READY (not yet wired to routes).
 *
 * Operational activity tracking for staff productivity (distinct from the
 * security-focused AuditLog): which staff member touched which order/menu item
 * and when. Powers per-staff performance reporting in a later phase.
 */
export interface IStaffActivity extends Document {
  _id: Types.ObjectId;
  staff: Types.ObjectId;
  kitchen: Types.ObjectId;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const staffActivitySchema = new Schema<IStaffActivity>(
  {
    staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', required: true, index: true },
    action: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

staffActivitySchema.index({ staff: 1, createdAt: -1 });

export const StaffActivity = model<IStaffActivity>('StaffActivity', staffActivitySchema);
