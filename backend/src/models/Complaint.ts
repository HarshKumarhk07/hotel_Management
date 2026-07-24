import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * Guest service ticket. `PENDING → ASSIGNED → IN_PROGRESS → COMPLETED → CLOSED`
 * is the intended lifecycle; `REJECTED` is a terminal side-exit and is retained
 * so tickets raised before the lifecycle existed still validate.
 */
export const COMPLAINT_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
  'REJECTED',
] as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export interface IComplaintEvent {
  status: ComplaintStatus;
  timestamp: Date;
  note?: string;
  updatedBy?: string;
}

export interface IComplaint extends Document {
  _id: Types.ObjectId;
  room: Types.ObjectId;
  /** The stay this ticket was raised against — set when the guest is checked in. */
  booking?: Types.ObjectId;
  guestName: string;
  phone: string;
  email?: string;
  category: 'HOUSEKEEPING' | 'MAINTENANCE' | 'ROOM_SERVICE' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description: string;
  status: ComplaintStatus;
  assignedStaff?: Types.ObjectId;
  staffNotes?: string;
  timeline: IComplaintEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const complaintEventSchema = new Schema<IComplaintEvent>(
  {
    status: { type: String, enum: COMPLAINT_STATUSES, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 1000 },
    updatedBy: { type: String, trim: true },
  },
  { _id: false }
);

const complaintSchema = new Schema<IComplaint>(
  {
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'RoomBooking', index: true },
    guestName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    category: {
      type: String,
      enum: ['HOUSEKEEPING', 'MAINTENANCE', 'ROOM_SERVICE', 'OTHER'],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: 'PENDING',
      index: true,
    },
    assignedStaff: { type: Schema.Types.ObjectId, ref: 'Staff', index: true },
    staffNotes: { type: String, trim: true, maxlength: 1000 },
    timeline: { type: [complaintEventSchema], default: [] },
  },
  { timestamps: true }
);

complaintSchema.index({ createdAt: -1 });

export const Complaint = model<IComplaint>('Complaint', complaintSchema);
