import { Schema, model, type Document, type Types } from 'mongoose';

export interface IComplaint extends Document {
  _id: Types.ObjectId;
  room: Types.ObjectId;
  guestName: string;
  phone: string;
  email?: string;
  category: 'HOUSEKEEPING' | 'MAINTENANCE' | 'ROOM_SERVICE' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  assignedStaff?: Types.ObjectId;
  staffNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const complaintSchema = new Schema<IComplaint>(
  {
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    guestName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, index: true },
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
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    assignedStaff: { type: Schema.Types.ObjectId, ref: 'Staff', index: true },
    staffNotes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

export const Complaint = model<IComplaint>('Complaint', complaintSchema);
